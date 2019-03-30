## Example: transfer.ts

This script closely follows the existing `transfer.sh` script from https://github.com/alexanderepstein/Bash-Snippets.

By using shellsync, the new code:
* Has unit tests. Note how all file system/process operations were mocked out using `sh.mockAllCommands()`.
* Is statically checked using TypeScript.
* Safely escapes variables. The original shell script was often missing `""` around variables, causing it to break when used with filenames containing spaces.
* Uses JavaScript's builtin support for regexes instead of shelling out to `sed`.
* Has simple error handling with `try/catch`. The original script repeated `|| echo ...; return 1` on many lines.
* Has functions with parameter names: `function singleDownload(targetPath, path, file)`. The original script used Bash's `singleDownload() { ... $1 ... $2 ... $3 }`