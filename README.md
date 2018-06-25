# shellsync

Shell scripting for node.js.

## Examples

Use `sh` to run shell commands and print to stdout:

```
import { createShell } from "shellsync";
const sh = createShell();
sh `echo foo`; // prints foo to console
```

Use `sh.val`, `sh.vals`, or `sh.json` to capture values:

```
let v1 = sh.val `echo hello`;             // sets v1 to "hello"
let v2 = sh.vals `ls`;                    // sets v2 to ["file1", "file2", ...]
let v3 = sh.json `echo '{"foo": "bar"}'`; // sets v3 to {"foo": "bar"}
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
let result = sh.out `ls ${filename}`; // automatically adds quotes around filename and escapes "
```

Use `unquoted()` to disable automatic quoting:

```
let command2 = "echo foo";
sh `ls; ${unquoted(command2)}`;
```

## License

MIT.