## Example: transfer.ts

This script closely follows the existing `transfer.sh` script from https://github.com/alexanderepstein/Bash-Snippets.

By using shellsync, the new code:
* Has unit tests. Note how all file system/process operations were mocked out using `sh.mockAllCommands()`.
* Supports for static checks using TypeScript.
* Safely escapes variables; the original shell script was missing `""` around variables in many places, and breaks when used with file names containing spaces.
* Has error handling with `try/catch`, avoiding `|| echo ...; return 1` repeating on many lines.
* Has functions with paramter names: `function singleDownload(targetPath, path, file)` instead of Bash's `singleDownload() { ... $1 ... $2 ... $3 }`