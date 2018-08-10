/*----------------------------------------------------------------------------------------------
 *  Copyright (c) Lennart C. L. Kats.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *----------------------------------------------------------------------------------------------*/
import * as child_process from "child_process";
import {SpawnSyncReturns, SpawnSyncOptionsWithStringEncoding} from "child_process";
import {Shell, ShellFunction, MockCommand, Mock, ShellOptions, TemplateError, ShellProperties, CreateShellFunction, TemplateVar} from "./types";
import {existsSync} from "fs";
import {handleSignals, handleSignalsEnd, parseEmittedSignal, wrapDisableInterrupts, isHandleSignalsActive} from "./handle_signals";
const shellEscape = require("any-shell-escape");
const metaStream = 3;
const mockStream = 4;
const stdioDefault = [0, "pipe", "inherit", "pipe", "pipe"];
const stdioHushed = [0, "pipe", "pipe", "pipe", "pipe"];
const stdioOut = [0, "inherit", "inherit", "pipe", "pipe"];
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
        command = wrapShellCommand(command, options, mocks);
        if (isHandleSignalsActive()) command = wrapDisableInterrupts(command);
        
        const childOptions = Object.assign({}, options, overrideOptions) as SpawnSyncOptionsWithStringEncoding;
        if (childOptions.input != null)
            childOptions.stdio = ["pipe", ...childOptions.stdio.slice(1)];

        child = child_process.spawnSync(shellProcess, ["-c", command], childOptions);
        const {output, stdout, stderr, status, error} = child;
        
        if (output && output[metaStream].startsWith("\0\0"))
            throw Object.assign(new Error(output[metaStream].substr(2)), {code: "EMOCK"});
        if (output && output[metaStream].startsWith("\0"))
            parseEmittedSignal(output[metaStream]);
        else if (output && output[metaStream])
            shell.options.cwd = output[metaStream];
        if (options.debug && stderr)
            console.error(cleanShellOutput(stderr));

        if (output && output[mockStream])
            output[mockStream].split("\0").forEach(reportMockCalled);

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
            } catch (e) {
                if (e.code === "EMOCK") throw e;
                return false;
            }
        },
        echo: (strings, ...args) => {
            const value = strings.map((string, i) => {
                if (i === strings.length - 1) return string;
                return string + shellStringify(args[i]);
            }).join("");
            if (mocks.find(m => m.name === "echo"))
                return sh`echo ${value}`;
            console.log(value);
        },
        mock: (pattern, command) => {
            if (pattern.match(/([\\"')(\n\r\$!`&<>\.\$;])/))
                throw new Error("Illegal character in pattern: " + RegExp.$1);
            const mock = {
                name: pattern.split(" ")[0],
                pattern,
                patternEscaped: pattern.replace(/\s/g, "\\ "),
                patternLength: pattern.replace(/\*$/, "").length,
                command: command || "",
                mock: {called: 0}
            };
            validateSyntax(mock);
            mocks.push(mock);
            mocks.sort((a, b) => b.patternLength - a.patternLength);
            return mock.mock;
        },
        mockAllCommands: () => {
            options.mockAllCommands = true;
        },
        mockRestore: (pattern?) => {
            if (!pattern) {
                options.mockAllCommands = false;
                mocks.splice(0, mocks.length);
                return;
            }
            if (!pattern.match(/^[A-Za-z0-9_$-]*\*?/))
                throw new Error("Unsupported mockRestore pattern: " + pattern);
            removeMock(pattern);
            if (options.mockAllCommands)
                shell.mock(pattern, `${pattern.split(" ")[0]} "$@"`);
        },
        handleSignals,
        handleSignalsEnd,
    };
    const removeMock = (pattern: string) => {
        let patternRegExp = new RegExp(pattern.replace(/\*/, ".*"));
        for (let i = mocks.length - 1; i >= 0; i--) {
            if (mocks[i].pattern.match(patternRegExp))
                mocks.splice(i, 1);
        }
    };
    const reportMockCalled = (pattern: string) => {
        for (let mock of mocks) {
            if (mock.pattern === pattern) mock.mock.called++
        }
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
                i++; break;
            case '`':
                process(BackTick); break;
            case '"':
                process(DoubleQuoted); break;
            case "'":
                if (last() === DoubleQuoted) break;
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
        shouldQuote: [SingleQuoted, DoubleQuoted].indexOf(last()) === -1,
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

function wrapShellCommand(command: string, options: ShellOptions, mocks: MockCommand[]) {
    const startDebugTrace = options.debug ? `{ builtin set -x; } 2>/dev/null` : `:`;
    const stopDebugTrace = options.debug ? `{ builtin set +x; } 2>/dev/null` : `:`;
    const {startMockAllCommands, stopMockAllCommands, setupMockAllCommands} =
        mockAllCommands(options, mocks, startDebugTrace, stopDebugTrace);
    return `:
        # Mock definitions
        __execMock() {
            case "$@" in
            ${mocks.map(m => `
                ${m.patternEscaped})
                    builtin shift;
                    ( ${m.name}() { builtin command ${m.name} "$@"; }
                      builtin printf '\\0${m.pattern}\\0' >&${mockStream}
                      ${startDebugTrace}
                      : mock for ${m.name} :
                      ${m.command}
                    )
                    ;;
            `).join("\n")}
            *) builtin command "$@" ;;
            esac
        }
        export -f __execMock

        # Functions to intercept mocked commands
        ${mocks.map(m => `
            ${m.name}() { ${stopDebugTrace}; __execMock ${m.name} "$@"; }
            builtin export -f ${m.name}
        `).join("\n")}

        ${setupMockAllCommands}
        ${startMockAllCommands}
        ${startDebugTrace}
        ${command}
        { RET=$?; } 2>/dev/null
        ${stopMockAllCommands}
        ${stopDebugTrace}

        # Capture current directory
        builtin command printf "$PWD">&${metaStream}
        builtin exit $RET
    `;
}

function mockAllCommands(options: ShellOptions, mocks: MockCommand[], startDebugTrace: string, stopDebugTrace: string) {
    if (!options.mockAllCommands)
        return {stopMockAllCommands: "", startMockAllCommands: "", setupMockAllCommands: ""};
    
    const stopMockAllCommands = `
        { builtin trap - DEBUG; } 2>/dev/null
    `;
    const startMockAllCommands = `
        builtin trap "${stopDebugTrace}; __failOnUnmocked; ${startDebugTrace}" DEBUG
    `;
    const setupMockAllCommands = `
        __failOnUnmocked() {
            local COMMAND=\${BASH_COMMAND-$3}
            if [[ $COMMAND =~ ^(builtin|return|exit|[{]|RET=\\$?|:$) ]]; then
                return
            fi
            case "$COMMAND" in
            ${mocks.map(m => `
                ${m.patternEscaped}) ;;
            `).join("\n")}
                 *) builtin printf "\\0\\0" >&${metaStream}
                    builtin echo "Unmocked command: $COMMAND" >&${metaStream}
                    builtin exit 1
            esac
        }
    `;
    return {setupMockAllCommands, stopMockAllCommands, startMockAllCommands}
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