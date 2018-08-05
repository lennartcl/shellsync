# shellsync

Synchronous shell scripting for Node.js.

* **Pragmatic**: automate tasks using synchronous code, using familiar commands from the command line.
* **Powerful**: use JavaScript or TypeScript functions, modules, libraries, and for constructs like try/catch/finally.
* **Robust**: use uninterruptable sections and harden your code with standard testing frameworks and mocking.
* **Safe**: avoid most Bash pitfalls and use automatic, safe variable escaping.

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

### Writing tests

> _"I find that writing unit tests actually increases my programming speed."_ – Martin Fowler

Test your shellsync scripts using mocking and standard testing frameworks such as Mocha or Jest.

Use `sh.mock(pattern, command)` to mock shell command using [glob patterns](https://mywiki.wooledge.org/glob). For example, use the pattern `git log` to mock any calls to `git log`, or use `git *` to mock all calls to `git` accross the board. If you have multiple mocks, the longest (most specific) matching pattern wins.

`sh.restoreMocks()` restores all mocked commands to the original shell command.

Example Mocha test:

```javascript
const sh = require("shellsync");

it("mocks git status", () => {
    sh.mock("git status", `echo git status called`);
    assert.equal(sh`git status`, "git status called");
});

it("mocks arbitrary git command", () => {
    sh.mock("git *", `echo git command called: $1`);
    assert.equal(sh`git foo`, "git command called: foo");
});

// Restore all mocked commands
afterEach(() => sh.mockRestore());
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

Note that `sh.handleSignals()` affects both shell and Node.js code. If you're concerned your program won't end until the [heat death of the universe](https://en.wikipedia.org/wiki/Heat_death_of_the_universe) and need to offer Control-C as an early way out, you can also pass a timeout in milliseconds: `sh.handleSignals({timeout: 3000})`.

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

### sh.mock(pattern, [command]): void

Define a mock: instead of `pattern`, run `command`.
Patterns consist of one or more words and support globbing from the second word, e.g.
`git`, `git status`, `git s*`. The longest (most specific) pattern is used in case multiple
mocks are defined.

### sh.mockRestore(): void

Remove all mocks.

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

### sh(options): Shell

Return a shell with specific options assigned. See `sh.options`. Example use:

```javascript
const input = "some text to write to a file";
sh({input})`cat > file.txt`;
```

### shh\`command\`: string

Same as `sh`; doesn't print anything to stdout or stderr.

## License

MIT.

## See also

* [shell-tag](https://www.npmjs.com/package/shell-tag) - Run shell commands with template strings
* [shell-escape-tag](https://www.npmjs.com/package/shell-escape-tag) - Run shell commands with template strings and control over escaping
* [any-shell-escape](https://www.npmjs.com/package/any-shell-escape) - Escape shell commands
* [shelljs](https://www.npmjs.com/package/shelljs) - Portable implementation of Unix shell commands such as `echo` and `grep`
