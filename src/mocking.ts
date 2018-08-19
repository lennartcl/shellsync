/*----------------------------------------------------------------------------------------------
 *  Copyright (c) Lennart C. L. Kats.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *----------------------------------------------------------------------------------------------*/
import {MockCommand, ShellOptions} from "./types";

const metaStream = 3;
const mockStream = 4;

type ValidatorFunction = (pattern: string) => void;

export class MockManager {
    readonly mocks: MockCommand[] = [];

    mockAllCommandsEnabled?: boolean;

    constructor() {}

    clear() {
        this.mocks.splice(0, this.mocks.length);
    }

    mock(pattern: string, command = "", validateCommandSyntax: ValidatorFunction, options: ShellOptions) {
        if (pattern.match(/^[\./]/))
            throw new Error("Unsupported mock pattern. To mock an external command like /bin/ls, call the command using 'command /bin/ls' and create a mock for 'command /bin/ls'");
        if (pattern.match(/([\\"')(\n\r\$!`&<>\$;]|\.\*)/))
            throw new Error("Unsupported character sequence in pattern: " + RegExp.$1);
        if (pattern.match(/^\w*\*\w*/))
            throw new Error("Pattern matching in first word is not supported: " + pattern);
        if (pattern.match(/^(builtin|unset|exit)\b/))
            throw new Error("Pattern not supported: " + pattern);
        const mock = {
            name: pattern.split(" ")[0],
            pattern,
            patternEscaped: pattern.replace(/\s/g, "\\ "),
            patternLength: pattern.replace(/\*$/, "").length,
            command: command || "",
            mock: {called: 0}
        };
        validateCommandSyntax(`${mock.name}() {\n${mock.command}\n:\n}`);
        this.removeMock(pattern, false);
        this.mocks.push(mock);
        this.mocks.sort((a, b) => b.patternLength - a.patternLength);
        return mock.mock;
    }

    unmock(pattern: string, validateCommandSyntax: ValidatorFunction, options: ShellOptions) {
        if (!pattern.match(/^[A-Za-z0-9_$-]*\*?/))
            throw new Error("Unsupported unmock pattern: " + pattern);
        this.removeMock(pattern, true);
        let commandName = pattern.split(" ")[0];
        if (this.mockAllCommandsEnabled)
            this.mock(pattern, `${commandName} "$@"`, validateCommandSyntax, options);
    }

    isMocked(name: string) {
        return this.mocks.find(m => m.name === name)
    }

    private removeMock(pattern: string, matchWithGlob: boolean) {
        let patternRegExp = new RegExp(pattern.replace(/\*/g, ".*").replace(/\[/g, "\\["));
        for (let i = this.mocks.length - 1; i >= 0; i--) {
            if (matchWithGlob ? this.mocks[i].pattern.match(patternRegExp) : this.mocks[i].pattern === pattern)
                this.mocks.splice(i, 1);
        }
    }

    processMockStream(output: string) {
        for (let pattern of output.split("\0")) {
            for (let mock of this.mocks) {
                if (mock.pattern === pattern) mock.mock.called++
            }
        }
    }

    createMockFunctions(options: ShellOptions, startDebugTrace: string, stopDebugTrace: string) {
        let defineMocks = `
            # Mock definitions
            __execMock() {
                case "$@" in
                ${this.mocks.map(m => `
                    ${m.patternEscaped})
                        builtin shift;
                        (   ${m.name}() { builtin command ${m.name} "$@"; }
                            builtin printf '\\0${m.pattern}\\0' >&${mockStream}
                            ${startDebugTrace}
                            : mock for ${m.name} :
                            ${m.command}
                        ) ;;
                `).join("\n")}
                *) builtin command "$@" ;;
                esac
            }

            # Functions to intercept mocked commands
            ${this.mocks.map(m => `
                ${m.name}() { ${stopDebugTrace}; __execMock ${m.name} "$@"; }
            `).join("\n")}
        `;
        let endMocks = this.mocks.length ? `{ unset -f printf; } 2>/dev/null` : ``;
        if (!this.mockAllCommandsEnabled)
            return {defineMocks, endMocks};
        
        defineMocks += `
            __mockAllCommands() {
                local COMMAND=$BASH_COMMAND
                if [[ $COMMAND =~ ^(builtin|return|exit|unset|export|RET=\\$?|:$) ]]; then
                    return
                fi
                case "$COMMAND" in
                ${this.mocks.map(m => `
                    ${m.patternEscaped}) ;;
                `).join("\n")}
                    [\\./]*)  
                        builtin printf "\\0\\0" >&${metaStream}
                        builtin echo "No mock for external command. To mock this command, use 'command $COMMAND' and create a mock that matches 'command $COMMAND'." >&${metaStream}
                        if [[ \${COMMAND%% *} != $COMMAND ]]; then
                            builtin echo "You can also use sh.unmock('\${COMMAND%% *} *') to remove the mock for this command." >&${metaStream}
                        else
                            builtin echo "You can also use sh.unmock('$COMMAND') to remove the mock for this command." >&${metaStream} 
                        fi
                        builtin exit 1 ;;
                    *)
                        builtin printf "\\0\\0" >&${metaStream}
                        if [[ \${COMMAND%% *} != $COMMAND ]]; then
                            builtin echo "No mock for command. To mock this command, add a mock for '$COMMAND' or a pattern like '\${COMMAND%% *} *'." >&${metaStream}
                            builtin echo "You can also use sh.unmock('\${COMMAND%% *} *') to remove the mock for this command." >&${metaStream} 
                        else
                            builtin echo "No mock for command. To mock this command, add a mock for '$COMMAND'." >&${metaStream}
                            builtin echo "You can also use sh.unmock('$COMMAND') to remove the mock for this command." >&${metaStream} 
                        fi
                        builtin exit 1
                esac
            }
            builtin trap "${stopDebugTrace}; __mockAllCommands; ${startDebugTrace}" DEBUG
        `;
        endMocks += `
            { builtin trap - DEBUG; } 2>/dev/null
        `;
        return {defineMocks, endMocks}
    }
}