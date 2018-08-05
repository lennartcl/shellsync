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
enum ParseState {
    BackTick,
    Expression,
    DoubleQuoted,
    SingleQuoted,
};

function createShell(options: ShellOptions = {}, mocks: MockCommand[] = []): Shell {
    options.encoding = options.encoding || "utf8";
    options.maxBuffer = options.maxBuffer || 10 * 1024 * 1024;
    options.stdio = options.stdio || stdioDefault;

    let child: SpawnSyncReturns<string>;

    const exec = (overrideOptions: ShellOptions, commands: TemplateStringsArray | TemplateError, ...commandVars: TemplateVar[]) => {
        const shellProcess = typeof options.shell === "string" ? options.shell : "/bin/bash";
        
        let command = quote(commands, ...commandVars);
        command = wrapShellCommand(command, mocks, options.debug);
        if (isHandleSignalsActive()) command = wrapDisableInterrupts(command);
        
        const childOptions = Object.assign({}, options, overrideOptions) as SpawnSyncOptionsWithStringEncoding;
        if (childOptions.input != null)
            childOptions.stdio = ["pipe", ...childOptions.stdio.slice(1)];

        child = child_process.spawnSync(shellProcess, ["-c", command], childOptions);
        const {output, stdout, stderr, status, error} = child;
        
        if (output && output[metaStream][0] === "\0")
            parseEmittedSignal(output[metaStream]);
        else if (output && output[metaStream])
            shell.options.cwd = output[metaStream];
        if (options.debug && stderr)
            console.error(cleanShellOutput(stderr));

        if (status) {
            throw Object.assign(
                new Error((stderr ? stderr + "\n" : "")
                    + "Error: Process exited with error code " + status),
                {code: status, stderr}
            );
        }
        if (error && (error as any).code === "ENOENT" && childOptions.cwd && !existsSync(childOptions.cwd)) {
            error.message = `cwd does not exist: ${childOptions.cwd}`;
            throw error;
        }
        if (error) throw error;
        return cleanShellOutput(stdout) || "";
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
        echo: (strings, ...args) => {
            if (typeof strings === "string") return console.log([strings, ...args].join(" "));
            console.log(strings.map((string, i) => {
                if (i === strings.length - 1) return string;
                return string + shellStringify(args[i]);
            }).join(""));
        },
        mock: (pattern, command) => {
            if (pattern.match(/([\\"')(\n\r\$!`&<>\.\$;])/))
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

    let parseState = {states: [] as ParseState[], shouldEscape: true};
    return commands.map((command, i) => {
        if (i === commands.length - 1) return command;
        parseState = parseFragment(parseState.states, command);
        return command + (parseState.shouldEscape ? shellStringify(commandVars[i]) : commandVars[i]);
    }).join("");
}

/** @internal */
export function parseFragment(states: ParseState[], fragment: string) {
    const {BackTick, SingleQuoted, DoubleQuoted, Expression} = ParseState;
    const process = (state: ParseState) => {
        if (last() === state) return states.pop();
        if (last() === SingleQuoted) return;
        states.push(state);
    };
    const last = () => states[states.length - 1];
    for (var i = 0; i < fragment.length; i++) {
        switch (fragment[i]) {
            case '\\':
                console.log("ESCAPE")
                i++; break;
            case '`':
                process(BackTick); break;
            case '"':
                process(DoubleQuoted); break;
            case "'":
                process(SingleQuoted); break;
            case '$':
                if (fragment[i+1] !== '(') break;
                if (last() == SingleQuoted) break;
                states.push(Expression); break;
            case ')':
                if (last() !== Expression) break;
                process(Expression); break;
        }
    }
    return {
        states,
        shouldEscape: [SingleQuoted, DoubleQuoted].indexOf(last()) === -1,
    };
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

function wrapShellCommand(command: string, mocks: MockCommand[], debug = false) {
    const setXtrace = debug ? `set -x` : ``;
    return `:
        # Mock definitions
        __execMock() {
            { set +x; } 2>/dev/null
            case "$@" in
            ${mocks.map(m => `
                ${m.pattern})
                    shift;
                    ( ${m.name}() { command ${m.name} "$@"; }
                      ${setXtrace}
                      : mock for ${m.name} :
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

        ${setXtrace}
        ${command}
        { RET=$?; set +x; } 2>/dev/null

        # Capture current directory
        command printf "$PWD">&${metaStream}; exit $RET
    `;
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