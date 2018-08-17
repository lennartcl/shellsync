# shellsync

Synchronous shell scripting for Node.js.

* **Pragmatic**: automate tasks using synchronous code, using familiar commands from the command line.
* **Powerful**: use JavaScript or TypeScript functions, modules, libraries, and constructs like try/catch/finally.
* **Robust**: use [uninterruptable sections](#uninterruptable-sections) and harden your code with standard [testing frameworks and strong support for mocking](#writing-tests).
* **Safe**: avoid most Bash pitfalls and use automatic, [safe variable escaping](#safe-variable-escaping).

## Usage

Use `sh` to synchronously run shell commands:

```javascript
const sh = require("shellsync");
const filename = "file name with spaces.txt";
sh`cd /tmp`;
sh`cat ${filename}`; // read filename\ with\ spaces.txt
```

Note how the above uses ES6 [tagged template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals),
calling the `sh` function without parentheses. This makes the invocations slightly shorter and allows shellsync to safely escape any values passed to it.

Use `sh`, `sh.array`, or `sh.json` to capture values:

```javascript
let v1 = sh`echo hello`;                 // set v1 to "hello"
let v2 = sh.array`lsof -t -i :8080`;     // set v2 to all process ids listening on port 8080
let v3 = sh.json`echo '{"foo": "bar"}'`; // set v3 to {"foo": "bar"}
```

Use `sh.test` to determine command success (by default, failure throws):

```javascript
if (!sh.test`which node`) {
    throw new Error("Node is not on the path!");
}
```

The commands above only output what is written to stderr. Use `sh.out` to also print stdout, or use `shh` completely mute stdout and stderr:

```javascript
const {shh} = require("shellsync");
shh`git init`;             // git init (no output printed)
sh.out`echo "SHOUTING!"`;  // print "SHOUTING!" to stdout
```

### Safe variable escaping

> _"The vast majority of [shell scripting] pitfalls are in some way related to unquoted expansions"_ – [Bash Pitfalls wiki](https://mywiki.wooledge.org/BashPitfalls)

shellsync safely quotes variables automatically:

```javascript
let filename = "filename with spaces.txt";
sh`echo "hello" > cat ${filename}`; // write to filename\ with\ spaces.txt
```

Use `unquoted()` to disable automatic quoting:

```javascript
import {unquoted} from "shellsync";
let command2 = "sudo apt-get install foo";
sh`ls; ${unquoted(command2)}`; // ls; sudo apt-get install foo
```

If you write your scripts using TypeScript with [`strictNullChecks`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html), undefined variables in shellsync invocations are reported as an error.

### Writing tests

> _"I find that writing unit tests actually increases my programming speed."_ – Martin Fowler

Test your shellsync scripts using mocking and standard testing frameworks such as Mocha or Jest.

Shell scripts often have many side effects, so it's a good habit to mock out commands
that touch the file system, interact with processes, and so on.

Use `sh.mock(pattern, command)` to mock shell command using [glob patterns](https://mywiki.wooledge.org/glob).
For example, use the pattern `git log` to mock any calls to `git log`, or use `git *` to mock all calls to
`git` accross the board. If you have multiple mocks, the longest (most specific) matching pattern wins:

```javascript
// Script under test
function script() {
    return sh`git status`;
}

// Mocha tests
it("mocks git status", () => {
    let mock = sh.mock("git status", `echo mock for git status`); // instead of 'git status', run 'echo ...'
    assert.equal(script(), "mock for git status");
    assert(mock.called);
});

it("mocks arbitrary git command", () => {
    let mock = sh.mock("git *", `echo git command called: $1`);
    assert.equal(script(), "git command called: status");
    assert(mock.called);
});
```

It's a good habit to mock out all shell commands that have side effects.
Use `sh.mockAllCommmands()` to ensure a mock exists _all_ shell commands.
You can then selectively add mocks or use `sh.unmock(pattern)` to unmock command:

```javascript
// Script under test
function script() {
    return sh`git status`;
}

// Before each Mocha test, mock the world 
beforeEach(() => sh.mockAllCommands());

// Mocha tests
it("fails when no mocks are defined", () => {
    program(); // FAILS: no mock was defined for "git status"
});

it("runs with git status mocked", () => {
    sh.mock("git status");
    program(); // passes, returns ""
});

it("runs with all git commands mocked", () => {
    sh.unmock("git *");
    program(); // passes, returns response of git status
});
```

Finally, `sh.unmockAllCommands()` restores all mocked commands to the original shell command.

```javascript
// After each Mocha test, restore all mocked commands
afterEach(() => sh.unmockAllCommands());
```

### Debugging

Use `sh.options.debug` to trace all commands executed by your scripts or your mocks:

```javascript
sh.options.debug = true;
sh.mock("ls *", "echo ls was mocked");
sh`cd /`;
sh`ls -l`;
// Prints:
// + cd /
// + ls -l
// + : mock for ls :
// + echo ls was mocked
// ls was mocked
```

### Uninterruptable sections

> _"Please do not interrupt me while I'm ignoring you"_ – unknown author

Users can press Control-C in CLI programs, which means they can end scripts
halfway _any statement_. That means they can leave a system
in an undefined state. In Node.js, Control-C even ends a program ignoring any `finally`
clauses that might be used for cleanup.

Use `sh.handleSignals()` for sections of code where these signals should be temporarily ignored:

```javascript
sh.handleSignals(); // begin critical section

sh`command1`;
sh`command2`;
sh`command3`;
sh`command4`;

sh.handleSignalsEnd(); // end critical section
```

Note that `sh.handleSignals()` affects both shell and Node.js code. If you're [concerned your program won't end](https://en.wikipedia.org/wiki/Termination_analysis) until the [heat death of the universe](https://en.wikipedia.org/wiki/Heat_death_of_the_universe) and need to offer Control-C as an early way out, you can also pass a timeout in milliseconds: `sh.handleSignals({timeout: 3000})`.

## API

### sh\`command\`: void

Execute a command, return stdout.

### sh.test\`command\`: boolean

Execute a command, return true in case of success.

### sh.array\`command\`: string[]

Execute a command, return stdout split by null characters (if found) or by newline characters.
Use `sh.options.fieldSeperator` to pick a custom delimiter character.

### sh.json\`command\`: any

Execute a command, parse the result as JSON.

### sh.handleSignals({timeout = null}): void

Disable processing of SIGINT/TERM/QUIT signals. Optionally accepts a `timeout` in milliseconds, or `null` for no timeout.

When invoked, any signals pending since the last invocation get processed.

### sh.handleSignalsEnd(): void

Re-enable processing of SIGINT/TERM/QUIT signals.

When invoked, any signals pending since the last invocation get processed.

### sh.echo`output`

Print `output` to stdout.

### sh.mock(pattern, [command]): Mock

Define a mock: instead of `pattern`, run `command`.
Patterns consist of one or more words and support globbing from the second word, e.g.
`git`, `git status`, `git s*`. The longest (most specific) pattern is used in case multiple
mocks are defined.

### sh.mockAllCommands(): void

Force mocks for all shell commands, throwing an error when an unmocked command is used.
Does not handle commands in subshells or shell functions.

### sh.unmock(pattern: string): void

Remove a specific mock by pattern. Best used with `mockAllCommands()`.

### sh.unmockAllCommands(): void

Remove all mocks. When `pattern` is specified, remove a single mock.

### sh.quote\`command\`: string

Similar to `sh`, but return the command that would be executed.

### sh.unquoted(...args): UnquotedPart

Create an unquoted part of a `command` template.

### sh.options: SpawnSyncOptions

See [the options for child_process](https://nodejs.org/api/child_process.html#child_process_child_process_spawnsync_command_args_options).

### sh.options.debug: boolean

Run in debug mode, printing commands that are executed.

### sh.options.fieldSeperator: string

The delimiter used for `sh.array`.

### sh.options.preferLocal: boolean

Whether to prefer executables installed in node_modules (using [npm-run-path](https://www.npmjs.com/package/npm-run-path)). Default `true`.

### sh(options): Shell

Return a shell with specific options assigned. See `sh.options`. Example use:

```javascript
const input = "some text to write to a file";
sh({input})`cat > file.txt`;
```

### shh\`command\`: string

Same as `sh`; doesn't print anything to stdout or stderr.

### Mock

A mock object.

#### Mock.called: number

Indicates how often this mock was called.

## License

MIT.

## See also

* [shell-tag](https://www.npmjs.com/package/shell-tag) - Run shell commands with template strings
* [shell-escape-tag](https://www.npmjs.com/package/shell-escape-tag) - Run shell commands with template strings and control over escaping
* [any-shell-escape](https://www.npmjs.com/package/any-shell-escape) - Escape shell commands
* [shelljs](https://www.npmjs.com/package/shelljs) - Portable implementation of Unix shell commands such as `echo` and `grep`
* [shunit2](https://github.com/kward/shunit2) – unit testing for Bash
* [bats](https://github.com/sstephenson/bats) – Bash automated testing system
* [Wooledge Bash pitfalls](https://mywiki.wooledge.org/BashPitfalls) - Bash Pitfalls wiki page
