/*----------------------------------------------------------------------------------------------
 *  Copyright (c) Lennart C. L. Kats.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *----------------------------------------------------------------------------------------------*/
import * as child_process from "child_process";
import {SpawnSyncReturns, SpawnSyncOptionsWithStringEncoding} from "child_process";
import {Shell, ShellFunction, MockCommand, ShellOptions, TemplateError, ShellProperties, CreateShellFunction, TemplateVar} from "./types";
import {existsSync} from "fs";
import {handleSignals, handleSignalsEnd, parseEmittedSignal, wrapDisableInterrupts, isHandleSignalsActive} from "./signals";
import {MockManager} from "./mocking";
const npmRunPath = require("npm-run-path");
const shellEscape = require("any-shell-escape");
const bashBuiltinError = 2;
const metaStream = 3;
const mockStream = 4;
const stdioDefault = [0, "pipe", "inherit", "pipe", "pipe"];
const stdioHushed = [0, "pipe", "pipe", "pipe", "pipe"];
const stdioOut = [0, "inherit", "inherit", "pipe", "pipe"];
enum ParseState {
    BackTick =  "BackTick",
    Expression = "Expression",
    DoubleQuoted = "DoubleQuoted",
    SingleQuoted = "SingleQuoted",
};

function createShell(options: ShellOptions, mocks = new MockManager()): Shell {
    options.encoding = options.encoding || "utf8";
    options.maxBuffer = options.maxBuffer || 10 * 1024 * 1024;
    options.stdio = options.stdio || stdioDefault;
    options.shell = options.shell || "/bin/bash";
    options.preferLocal = options.preferLocal === undefined ? true : options.preferLocal;
        
    const exec = (overrideOptions: ShellOptions, commands: TemplateStringsArray | TemplateError, ...commandVars: TemplateVar[]) => {
        let basicCommand = quote(commands, ...commandVars);
        let command = wrapShellCommand(basicCommand, options, mocks);
        if (isHandleSignalsActive()) command = wrapDisableInterrupts(command);

        if (mocks.mockAllCommandsEnabled && parseFragment([], basicCommand).hasSubshell)
            throw new Error("Command appears to have a subshell; mockAllCommands() does not support subshells: " + basicCommand);
        
        const childOptions = Object.assign({}, options, overrideOptions) as SpawnSyncOptionsWithStringEncoding;
        if (childOptions.input != null)
            childOptions.stdio = ["pipe", ...childOptions.stdio.slice(1)];
        if (options.preferLocal)
            childOptions.env = Object.assign(npmRunPath.env(), childOptions.env);

        const child = child_process.spawnSync(options.shell!, ["-c", command], childOptions);
        const {output, stdout, stderr, status, error} = child;
        
        if (output && output[metaStream].startsWith("\0\0"))
            throw Object.assign(new Error(output[metaStream].substr(2).trim()), {code: "EMOCK"});
        else if (output && output[metaStream].startsWith("\0"))
            parseEmittedSignal(output[metaStream]);
        else if (output && output[metaStream])
            shell.options.cwd = output[metaStream];
        if (options.debug && stderr)
            console.error(cleanShellOutput(stderr));

        if (output && output[mockStream])
            mocks.processMockStream(output[mockStream]);

        if (status) {
            if (status === bashBuiltinError) validateCommandSyntax(basicCommand);
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
            } catch (e) {
                if (e.code === "EMOCK") throw e;
                return false;
            }
        },
        echo: (strings, ...args) => {
            const value = strings.map((string, i) => {
                if (i === strings.length - 1) return string;
                return string + args[i];
            }).join("");
            if (mocks.isMocked("echo"))
                return sh`echo ${value}`;
            console.log(value);
        },
        mock: (pattern, command) => {
            return mocks.mock(pattern, command, validateCommandSyntax, options);
        },
        mockAllCommands: () => {
            mocks.mockAllCommandsEnabled = true;
        },
        unmockAllCommands: () => {
            mocks.mockAllCommandsEnabled = false;
            mocks.clear();
        },
        unmock: (pattern) => {
            mocks.unmock(pattern, validateCommandSyntax, options);
        },
        handleSignals,
        handleSignalsEnd,
    };
    const validateCommandSyntax = (command: string): void => {
        let parse = child_process.spawnSync(options.shell!, ["-n"], {input: command});
        if (!parse.status) return;
        
        const error = `Syntax error in command: \`${command}\`\n${parse.stderr}`;
        throw Object.assign(new Error(error), {code: parse.status, stderr: parse.stderr});
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

    let parseState = {states: [] as ParseState[], shouldQuote: true};
    return commands.map((command, i) => {
        if (i === commands.length - 1) return command;
        parseState = parseFragment(parseState.states, command);
        if (commandVars[i] === undefined)
            throw new Error("Undefined variable in `" + commands.join("${...}") + "`");
        return command + (parseState.shouldQuote ? shellStringify(commandVars[i]) : commandVars[i]);
    }).join("");
}

/**
 * Parse a shell fragment to determine whether variables inside it should be
 * quoted or not. For example, shellsync will quote for
 * `echo ${var}` but not for `echo "${var}"`.
 */
function parseFragment(states: ParseState[], fragment: string) {
    let hasSubshell = fragment[0] === "(";
    let maybeAtLineStart = true;
    const {BackTick, SingleQuoted, DoubleQuoted, Expression} = ParseState;
    const process = (state: ParseState) => {
        if (last() === state) return states.pop();
        if (last() === SingleQuoted) return;
        states.push(state);
    };
    const last = () => states[states.length - 1];
    for (var i = 0; i < fragment.length; i++) {
        let char = fragment[i];
        switch (char) {
            case '\\':
                i++; break;
            case '`':
                if (last() == SingleQuoted) break;
                hasSubshell = true;
                process(BackTick); break;
            case '"':
                process(DoubleQuoted); break;
            case "'":
                if (last() === DoubleQuoted) break;
                process(SingleQuoted); break;
            case '$':
                if (fragment[i+1] !== '(') break;
                if (last() == SingleQuoted) break;
                states.push(Expression);
                hasSubshell = true;
                break;
            case ')':
                if (last() !== Expression) break;
                process(Expression); break;
        }
    }
    return {
        states,
        /** Whether the next template variable should be quoted. */
        shouldQuote: [SingleQuoted, DoubleQuoted].indexOf(last()) === -1,
        /** Whether a subshell was used. Underapproximated. */
        hasSubshell,
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

function wrapShellCommand(command: string, options: ShellOptions, mocks: MockManager) {
    const startDebugTrace = options.debug ? `{ builtin set -x; } 2>/dev/null` : `:`;
    const stopDebugTrace = options.debug ? `{ builtin set +x; } 2>/dev/null` : `:`;
    const {defineMocks, endMocks} = mocks.createMockFunctions(options, startDebugTrace, stopDebugTrace);
    return `:
        ${defineMocks}
        ${startDebugTrace}
        ${command}
        { RET=$?; } 2>/dev/null
        ${endMocks}
        ${stopDebugTrace}

        # Capture current directory
        builtin command printf "$PWD">&${metaStream}
        builtin exit $RET
    `;
}

const sharedMocks = new MockManager();
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