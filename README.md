# shellsync

Shell scripting for node.js.

## Examples

Use `sh` to synchronously run shell commands and print to stdout:

```
let sh = require("shellsync");
sh `cd /tmp`;
sh `ls`;      // print file listing of /tmp to stdout
```

Use `sh.val`, `sh.vals`, or `sh.json` to capture values:

```
let v1 = sh.val `echo hello`;             // set v1 to "hello"
let v2 = sh.vals `ls`;                    // set v2 to ["file1", "file2", ...]
let v3 = sh.json `echo '{"foo": "bar"}'`; // set v3 to {"foo": "bar"}
```

Use `sh.test` to determine command success (by default, failure throws):

```
if (!sh.test `which node`) {
    throw new Error("Node is not on the path!");
}
```

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

## License

MIT.

## See also

* [shell-tag](https://www.npmjs.com/package/shell-tag) - Run shell commands with template strings
* [shell-escape-tag](https://www.npmjs.com/package/shell-escape-tag) - Run shell commands with template strings and control over escaping
* [any-shell-escape](https://www.npmjs.com/package/any-shell-escape) - Escape shell commands
* [shelljs](https://www.npmjs.com/package/shelljs) - Portable implementation of Unix shell commands such as `echo` and `grep`