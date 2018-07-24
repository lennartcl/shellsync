import { SpawnSyncOptions } from "child_process";

export interface Shell extends ShellProperties, ShellFunction<void> {}

export interface ShellProperties {
    options: ShellOptions;
    val: ShellFunction<string>;
    vals: ShellFunction<string[]>;
    json: ShellFunction<any | null>;
    test: ShellFunction<string | boolean>;
    mock(pattern: string, command?: string): void;
    mockRestore(): void;
}

export interface ShellOptions extends SpawnSyncOptions {
    fieldSeperator?: string;
    encoding?: BufferEncoding;
}

export type TemplateError = "<<< Please invoke using template literal syntax, e.g. sh `command`;";

export type ShellFunction<T> = (
    commands: TemplateStringsArray | TemplateError,
    ...commandVars: any[]
) => T;

export interface MockCommand {
    name: string;
    pattern: string;
    patternLength: number;
    command: string;
}