import { SpawnSyncOptions } from "child_process";

export interface Shell extends ShellProperties, ShellFunction<string>, CreateShellFunction {}

export interface ShellProperties {
    /** Options for this shell. */
    options: ShellOptions;

    /** Execute a command, print stdout and stderr. */
    out: ShellFunction<void>;

    /**
     * Execute a command, return stdout split by null characters (if found) or by newline characters.
     * Use `sh.options.fieldSeperator` to pick a custom delimiter character.
     */
    array: ShellFunction<string[]>;

    /** Execute a command, parse the result as JSON. */
    json: ShellFunction<JSON>;

    /** Execute a command, return true in case of success. */
    test: ShellFunction<boolean>;

    /** Print a string to standard output. */
    echo: (strings: TemplateStringsArray, ...args: TemplateVar[]) => void;

    /**
     * Define a mock: instead of `pattern`, run `command`.
     * Patterns consist of one or more words and support globbing from the second word, e.g.
     * `git`, `git status`, `git s*`. The most specific pattern is used in case multiple
     * mocks are defined.
     */
    mock(pattern: string, command?: string): Mock;

    /**
     * Force mocks for all shell commands, throwing an error when an unmocked command is used.
     * Does not handle commands in subshells or shell functions.
     */
    mockAllCommands(): void,

    /** Remove all mocks. */
    unmockAllCommands(): void;

    /** Remove a specific mock by pattern. Best used with {@link #mockAllCommands}. */
    unmock(pattern: string): void;

    /**
     * Disable or delay processing of SIGINT/TERM/QUIT signals. Also, process any pending signals.
     */
    handleSignals(options?: HandleSignalsOptions): void;

    /**
     * Re-enable processing of SIGINT/TERM/QUIT signals. Also, process any pending signals.
     */
    handleSignalsEnd(): void;
}

export interface HandleSignalsOptions {
    /** Timeout in milliseconds, or `null` for no timeout. Default `null`. */
    timeout?: number | null;
};

type JSON = Object | string | number | boolean | null;

export interface ShellOptions extends SpawnSyncOptions {
    encoding?: BufferEncoding;

    /** The delimiter used for `sh.array`. */
    fieldSeperator?: string;

    /** Run in debug mode, printing commands that are executed. */
    debug?: boolean;

    /**
     * Largest amount of data in bytes allowed on stdout or stderr. If exceeded, the child process is terminated.
     * Default: `10 * 1024 * 1024`.
     */
    maxBuffer?: number;

    mockAllCommands?: boolean;
}

export type TemplateError = "<<< Please invoke using template literal syntax, e.g. sh `command`;";

export type ShellFunction<T> = (
    commands: TemplateStringsArray | TemplateError,
    ...commandVars: TemplateVar[]
) => T;

export type TemplateVar = Exclude<JSON, null>;

export type CreateShellFunction = (options?: ShellOptions) => Shell;

export interface MockCommand {
    name: string;
    pattern: string;
    patternEscaped: string;
    patternLength: number;
    command: string;
    mock: Mock;
}

export interface Mock {
    called: number;
}