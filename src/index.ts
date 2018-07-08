/*----------------------------------------------------------------------------------------------
 *  Copyright (c) Lennart C. L. Kats.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *----------------------------------------------------------------------------------------------*/
import * as shellEscape from "any-shell-escape";
import * as child_process from "child_process";
import { SpawnOptions, SpawnSyncReturns, SpawnSyncOptionsWithStringEncoding, SpawnSyncOptions } from "child_process";

interface Shell extends ShellFunction<string> {
    options: SpawnOptions;
    val: ShellFunction<string>;
    vals: ShellFunction<string[]>;
    json: ShellFunction<any | null>;
    test: ShellFunction<string | boolean>;
}

interface ShellOptions extends SpawnSyncOptions {
    fieldSeperator?: string;
    encoding?: BufferEncoding;
}

type ShellFunction<T> = (commands: TemplateStringsArray | string, ...commandVars: any[]) => T;

function createShell(
    options: ShellOptions = {
        encoding: "utf8"
    }): Shell {
    let child: SpawnSyncReturns<string>;

    const exec = (overrideOptions: ShellOptions, commands, ...commandVars) => {
        const shellProcess = typeof options.shell === "string" ? options.shell : "/bin/bash";
        const command = quote(commands, ...commandVars) + `\nRET=$?; echo -n "$PWD">&3; exit $RET`
        const stringOptions = Object.assign({}, options, overrideOptions) as SpawnSyncOptionsWithStringEncoding;
        child = child_process.spawnSync(shellProcess, ["-c", command], stringOptions);
        if (child.status) {
            throw Object.assign(
                new Error((child.stderr ? child.stderr.toString() + "\n" : "")
                    + "Process exited with error code " + child.status),
                { code: child.status }
            );
        }
        if (child.error)
            throw child.error;
        if (child.output && child.output[3])
            shell.options.cwd = child.output[3];
        return cleanShellOutput(child.stdout && child.stdout.toString()) || "";
    };
    const cleanShellOutput = (output: string) => {
        return output && output.replace(/\n$/, "") || output;
    };
    const shell = Object.assign(
        (commands, ...commandVars) => {
            return exec({stdio: [0, "inherit", "inherit", "pipe"]}, commands, ...commandVars);
        },
        {
            get options() { return options },
            set options(value) { options = value },
            val: (commands, ...commandVars) => {
                return exec({stdio: [0, "pipe", "pipe", "pipe"]}, commands, ...commandVars);
            },
            vals: (commands, ...commandVars) => {
                return shell.val(commands, ...commandVars).split(options.fieldSeperator || "\n");
            },
            json: (commands, ...commandVars) => {
                return JSON.parse(shell.val(commands, ...commandVars));
            },
            test: (commands, ...commandVars) => {
                try {
                    return shell.val(commands, ...commandVars) || true;
                } catch (e) {
                    return false;
                }
            }
        }
    );
    return shell;
}

const quote: ShellFunction<string> = (commands, ...commandVars) => {
    if (typeof commands === "string")
        return [commands, ...commandVars.map(shellStringify)].join(" ");
    return commands.map((command, i) => {
        if (i === commands.length - 1)
            return command;
        return command + shellStringify(commandVars[i]);
    }).join("");
}

function shellStringify(arg: any): string {
    if (arg == null)
        return "''";
    if (arg instanceof UnquotedParts)
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

function unquoted(...args: any[]) {
    return new UnquotedParts(args);
}

class UnquotedParts {
    constructor(private args: any[]) {}

    toString(): string {
        return this.args.map(stringify).join(" ");
    }
}

const shell = createShell();
const sh = Object.assign(shell, {sh: shell, createShell, quote, unquoted, default: shell});
namespace sh {}
export = sh;