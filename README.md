# shellsync

Shell scripting for node.js.

## Examples

Use `sh` to run shell commands and print to stdout:

```
import { createShell } from "shellsync";
const sh = createShell();
sh `echo foo`; // prints foo to console
```

Use `sh.val` to capture a string value from the shell:

```
let result = sh.val `echo hello`; // sets result to "hello"
```

Use `sh.vals` or `sh.json` to capture multiple values or parse JSON from the shell:

```
let files = sh.vals `ls`;                   // sets files to an array of filenames
let json = sh.json `echo '{"foo": "bar"}'`; // sets json to {"foo": "bar"}
```

Use `sh.test` to determine if a command was successful (by default, failure throws):

```
if (!sh.test `which node`) {
    throw new Error("Node is not on the path!");
}
```

Template values are automatically quoted:

```
let filename = "filename with spaces.txt";
let result = sh.out `ls ${filename}`; // automatically adds quotes around filename and escapes "
```

Use `unescape()` to avoid automatic quoting:

```
let command2 = "echo foo";
sh `ls; ${unescape(command2)}`;
```

## License

MIT.