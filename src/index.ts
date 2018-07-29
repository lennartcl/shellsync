/*----------------------------------------------------------------------------------------------
 *  Copyright (c) Lennart C. L. Kats.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *----------------------------------------------------------------------------------------------*/
import * as child_process from "child_process";
import {SpawnSyncReturns, SpawnSyncOptionsWithStringEncoding} from "child_process";
import {Shell, ShellFunction, MockCommand, ShellOptions, TemplateError, ShellProperties, CreateShellFunction, TemplateVar} from "./types";
import {existsSync} from "fs";
import {handleSignals, handleSignalsEnd, parseEmittedSignal, wrapDisableInterrupts, isHandleSignalsActive} from "./handle_signals";
const shellEscape = require("any-shell-escape");
const metaStream = 3;
const stdioDefault = [0, "pipe", "inherit", "pipe"];
const stdioHushed = [0, "pipe", "pipe", "pipe"];
const stdioOut = [0, "inherit", "inherit", "pipe"];

function createShell(options: ShellOptions = {}, mocks: MockCommand[] = []): Shell {
    options.encoding = options.encoding || "utf8";
    options.maxBuffer = options.maxBuffer || 10 * 1024 * 1024;
    options.stdio = options.stdio || stdioDefault;

    let child: SpawnSyncReturns<string>;

    const exec = (overrideOptions: ShellOptions, commands: TemplateStringsArray | TemplateError, ...commandVars: TemplateVar[]) => {
        const shellProcess = typeof options.shell === "string" ? options.shell : "/bin/bash";
        
        let command = quote(commands, ...commandVars);
        if (options.debug) command = wrapDebug(command);
        command = wrapShellCommand(command, mocks);
        if (isHandleSignalsActive()) command = wrapDisableInterrupts(command);
        
        const childOptions = Object.assign({}, options, overrideOptions) as SpawnSyncOptionsWithStringEncoding;
        if (childOptions.input != null)
            childOptions.stdio = ["pipe", ...childOptions.stdio.slice(1)];

        child = child_process.spawnSync(shellProcess, ["-c", command], childOptions);
        
        if (child.output && child.output[metaStream][0] === "\0")
            parseEmittedSignal(child.output[metaStream]);
        else if (child.output && child.output[metaStream])
            shell.options.cwd = child.output[metaStream];
        if (options.debug && child.stderr)
            console.error(cleanShellOutput(child.stderr));

        if (child.status) {
            throw Object.assign(
                new Error((child.stderr ? child.stderr + "\n" : "")
                    + "Error: Process exited with error code " + child.status),
                {code: child.status, stderr: child.stderr}
            );
        }
        if (child.error && (child.error as any).code === "ENOENT" && childOptions.cwd && !existsSync(childOptions.cwd)) {
            child.error.message = `cwd does not exist: ${childOptions.cwd}`;
            throw child.error;
        }
        if (child.error) throw child.error;
        return cleanShellOutput(child.stdout && child.stdout.toString()) || "";
    };

    const shell: ShellProperties = {
        get options() { return options },
        set options(value) { options = value },
        out: (commands, ...commandVars) => {
            return exec({stdio: stdioOut}, commands, ...commandVars);
        },
        array: (commands, ...commandVars) => {
            return exec({}, commands, ...commandVars).split(options.fieldSeperator || "\n");
        },
        json: (commands, ...commandVars) => {
            return JSON.parse(exec({}, commands, ...commandVars));
        },
        test: (commands, ...commandVars) => {
            try {
                exec({stdio: stdioHushed}, commands, ...commandVars);
                return true;
            } catch {
                return false;
            }
        },
        mock: (pattern, command) => {
            if (pattern.match(/([\\"')(\n\r\$!`&<>\.])/))
                throw new Error("Illegal character in pattern: " + RegExp.$1);
            const mock = {
                name: pattern.split(" ")[0],
                pattern: pattern.replace(/\s/g, "\\ "),
                patternLength: pattern.replace(/\*$/, "").length,
                command: command || "",
            };
            validateSyntax(mock);
            mocks.push(mock);
            mocks.sort((a, b) => b.patternLength - a.patternLength);
        },
        mockRestore: () => {
            mocks.splice(0, mocks.length);
        },
        handleSignals,
        handleSignalsEnd,
    };
    const validateSyntax = (mock: MockCommand): void => {
        try {
            shellHushed`${mock.name}() {\n${unquoted(mock.command)}\n:\n}`;
        }
        catch (e) {
            e.message = `Error in mock: ${mock.command}\n${e.stderr}`;
            throw e;
        }
    };
    const execOrCreateShell: ShellFunction<string> & CreateShellFunction =
        (arg: any = {}, ...commandVars: any[]): any => {
            if (arg.length) return exec({}, arg, ...commandVars);
            return createShell(Object.assign({}, options, arg));
        };
    return Object.assign(execOrCreateShell, shell);
}

const quote: ShellFunction<string> = (commands, ...commandVars) => {
    if (typeof commands === "string") {
        console.warn("Warning: shellsync function invoked using string argument; please invoke using template literal syntax, e.g. sh `command`;")
        return [commands, ...commandVars.map(shellStringify)].join(" ");
    }
    return commands.map((command, i) => {
        if (i === commands.length - 1)
            return command;
        return command + shellStringify(commandVars[i]);
    }).join("");
}

function cleanShellOutput(output: string) {
    return output && output.replace(/\n$/, "") || output;
};

function shellStringify(arg: any): string {
    if (arg == null)
        return "''";
    if (arg instanceof UnquotedPart)
        return arg.toString();
    return shellEscape(stringify(arg));
}

function stringify(arg: any): string {
    if (typeof arg === "string")
        return arg;
    if (arg != null)
        return arg.toString() || "";
    return "";
}

const unquoted = (...args: TemplateVar[]): Object => {
    return new UnquotedPart(args);
}

class UnquotedPart {
    constructor(private args: TemplateVar[]) {}

    toString(): string {
        return this.args.map(stringify).join(" ");
    }
}

function wrapShellCommand(command: string, mocks: MockCommand[]) {
    return `
        # Mock definitions
        __execMock() {
            case "$@" in
            ${mocks.map(m => `
                ${m.pattern})
                    shift;
                    ( ${m.name}() { command ${m.name} "$@"; }
                      ${m.command}
                    )
                    ;;
            `).join("\n")}
            *) command "$@" ;;
            esac
        }
        export -f __execMock

        # Functions to intercept mocked commands
        ${mocks.map(m => `
            ${m.name}() { __execMock ${m.name} "$@"; }
            export -f ${m.name}
        `).join("\n")}

        ${command}

        # Capture current directory
        RET=$?; command echo -n "$PWD">&${metaStream}; exit $RET
    `;
}

function wrapDebug(command: string) {
    return `(set -x\n${command}\n)`;
}

const sharedMocks: MockCommand[] = [];
const shell = createShell({}, sharedMocks);
const shellHushed = createShell(Object.assign({}, shell.options, {stdio: stdioHushed}), sharedMocks);
const sh = Object.assign(
    shell,
    {
        /** Execute a command. Return stdout as a string; print stderr. */
        sh: shell,
        /** Execute a command. Don't print anything to stdout or stderr. */
        shh: shellHushed,
        quote,
        unquoted,
        default: shell,
    }
);
namespace sh {}
export = sh;