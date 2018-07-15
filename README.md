# shellsync

Shell scripting for Node.js.

* Pragmatic: automate tasks using synchronous code and with familiar commands from the command line.
* Powerful: use JavaScript or TypeScript functions, modules, and libraries.
* Safe: use variables in shell scripts with safe, automatic escaping.
* Robust: test your code with support for mocking and standard testing frameworks such as Mocha or Jest.

## Basics

Use `sh` to synchronously run shell commands and print to stdout:

```
const sh = require("shellsync");
sh `cd /tmp`;
sh `ls`;      // print file listing of /tmp to stdout
```

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

## Using JavaScript variables

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

## Writing tests

Test your shellsync scripts using mocking and standard testing frameworks such as Mocha or Jest.

Use `sh.mock(command, targetCommand)` to mock shell command patterns such as "git", "git log",
or "git status". The most specific mock wins.

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
    sh.mock("git", `echo git command called: $1`);
    assert.equal(sh.val `git foo`, "git command called: foo");
});
```

## License

MIT.

## See also

* [shell-tag](https://www.npmjs.com/package/shell-tag) - Run shell commands with template strings
* [shell-escape-tag](https://www.npmjs.com/package/shell-escape-tag) - Run shell commands with template strings and control over escaping
* [any-shell-escape](https://www.npmjs.com/package/any-shell-escape) - Escape shell commands
* [shelljs](https://www.npmjs.com/package/shelljs) - Portable implementation of Unix shell commands such as `echo` and `grep`
