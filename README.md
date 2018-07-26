# shellsync

Shell scripting for Node.js.

* Pragmatic: automate tasks using synchronous code and with familiar commands from the command line.
* Powerful: use JavaScript or TypeScript functions, modules, and libraries.
* Safe: use variables in shell scripts with safe, automatic escaping.
* Robust: test your code with support for mocking and standard testing frameworks such as Mocha or Jest.

## Usage

Use `sh` to synchronously run shell commands and print to stdout:

```
const sh = require("shellsync");
sh `cd /tmp`;
sh `ls`;      // print file listing of /tmp to stdout
```

Note how the above uses ES6 [tagged template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals),
calling the `sh` function without parentheses. This makes the invocations slightly shorter allows shellsync to safely quote any values passed to it.

Use `sh.val`, `sh.vals`, or `sh.json` to capture values:

```
let v1 = sh.val `echo hello`;             // set v1 to "hello"
let v2 = sh.vals `lsof -t -i :8080`;      // set v2 to all process ids listening on port 8080
let v3 = sh.json `echo '{"foo": "bar"}'`; // set v3 to {"foo": "bar"}
```

Use `sh.test` to determine command success (by default, failure throws):

```
if (!sh.test `which node`) {
    throw new Error("Node is not on the path!");
}
```

Use `shh` to run commands without printing anything to stdout or stderr:

```
const {shh} = require("shellsync");
shh `git init`;
```

### Using JavaScript variables

Template values are automatically quoted:

```
let filename = "filename with spaces.txt";
let contents = sh.val `cat ${filename}`; // ls filename\ with\ spaces.txt
```

Use `unquoted()` to disable automatic quoting:

```
import { unquoted } from "shellsync";
let command2 = "echo foo";
sh `ls; ${unquoted(command2)}`; // ls; echo foo
```

### Writing tests

Test your shellsync scripts using mocking and standard testing frameworks such as Mocha or Jest.

Use `sh.mock(command, targetCommand)` to mock shell command using [globs](https://mywiki.wooledge.org/glob)
such as `git log`, `git status`, or `git *`. The shortest pattern wins.

Use `sh.restoreMocks()` to restore all mocked commands to the original shell command.

Example Mocha test:

```
const sh = require("shellsync");

beforeEach(() => sh.mockRestore());

it("mocks git status", () => {
    sh.mock("git status", `echo git status called`);
    assert.equal(sh.val `git status`, "git status called");
});

it("mocks arbitrary git command", () => {
    sh.mock("git *", `echo git command called: $1`);
    assert.equal(sh.val `git foo`, "git command called: foo");
});
```

## API

### sh \`command\`: void

Execute a command.

### sh.test \`command\`: boolean

Execute a command, return true in case of success.

### sh.val \`command\`: string

Execute a command, return stdout.

### sh.vals \`command\`: string[]

Execute a command, return stdout split by null characters (if found) or by newline characters.
Use `sh.options.fieldSeperator` to pick a custom delimiter character.

### sh.mock(pattern, [\`command\`]): void

Define a mock: instead of `pattern`, run `command`.
Patterns consist of one or more words and support globbing from the second word, e.g.
`git`, `git status`, `git s*`. The most specific pattern is used in case multiple
mocks are defined.

### sh.mockRestore(): void

Remove all mocks.

### sh.quote \`command\`: string

Similar to `sh`, but return the command that would be executed.

### sh.unquoted(...args): UnquotedPart

Create an unquoted part of a `command` template.

### sh.options: SpawnSyncOptions

See [the options for child_process](https://nodejs.org/api/child_process.html#child_process_child_process_spawnsync_command_args_options).

### sh.options.debug: boolean

Run in debug mode, printing commands that are executed.

### sh.options.fieldSeperator: string

The delimiter used for `sh.vals`.

### sh(options): Shell

Return a shell with specific options assigned. See `sh.options`. Example use: `sh({input: "stdin input"})\`cat > file.txt\``.

### shh \`command\`: void

Execute a command. Don't print anything to stdout or stderr.

## License

MIT.

## See also

* [shell-tag](https://www.npmjs.com/package/shell-tag) - Run shell commands with template strings
* [shell-escape-tag](https://www.npmjs.com/package/shell-escape-tag) - Run shell commands with template strings and control over escaping
* [any-shell-escape](https://www.npmjs.com/package/any-shell-escape) - Escape shell commands
* [shelljs](https://www.npmjs.com/package/shelljs) - Portable implementation of Unix shell commands such as `echo` and `grep`
