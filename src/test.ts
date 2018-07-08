import * as assert from "assert";
import { createShell, quote, unquoted } from "./index";
import defaultExportSh from "./index";
import { sh as shExport } from "./index";

describe('#quote', () => {
    it('supports strings without args', () => {
        const escaped = quote(`foo "bar"`);
        assert.equal(escaped, `foo "bar"`);
    });
    
    it('supports strings without args in template form', () => {
        const escaped = quote`foo "bar"`;
        assert.equal(escaped, `foo "bar"`);
    });
    
    it('supports tagged templates', () => {
        const bar = "bar";
        const baz = '"baz"';
        const escaped = quote`foo ${bar} ${baz}`;
        assert.equal(escaped, `foo bar '"baz"'`);
    });
    
    it('supports string arguments', () => {
        const bar = "bar";
        const baz = '"baz"';
        const escaped = quote("foo", bar, baz, null, undefined);
        assert.equal(escaped, `foo bar '"baz"' '' ''`);
    });
    
    it('supports unescaped arguments', () => {
        const args = "bar baz";
        const escaped = quote`foo ${unquoted(args)} ${unquoted()}`;
        assert.equal(escaped, `foo bar baz `);
    });

    it('supports falsy arguments', () => {
        const escaped = quote`foo ${false} ${undefined} ${0}`;
        assert.equal(escaped, `foo false '' 0`);
    });

    it('supports optional typed values', () => {
        interface Foo {
            opt?: string
        }
        const foo: Foo = { opt: "opt "};
        quote `foo.opt = ${foo.opt}`
    });

    it('supports plain string arguments', () => {
        const escaped = quote("echo hi");
        assert.equal(escaped, "echo hi");
    });
});

describe('#createShell', () => {
    let sh = createShell();
    
    it('can echo', () => {
        const hoi = `"hoi"`;
        const result = sh.val `echo ${hoi}`;
        assert.equal(result, `"hoi"`);
    });

    it('respects cwd', () => {
        sh.options.cwd = "/";
        const result = sh.val `echo $PWD`;
        assert.equal(result, `/`);
    });
    
    it('respects cd', () => {
        sh.options.cwd = "/";
        sh `cd tmp`;
        assert.equal(sh.options.cwd, `/tmp`);
    });
    
    it('supports .test()', () => {
        const result2 = sh.test `exit 0`;
        assert.equal(result2, true);
        const result1 = sh.test `exit 1`;
        assert.equal(result1, false);
    });
    
    it('respects exit codes', () => {
        try {
            sh.test `exit 3`;
        } catch (err) {
            assert.equal(err.code, 3);
        }
    });
    
    it('supports .test() with string values', () => {
        const result2 = sh.test `echo success`;
        assert.equal(result2, "success");
        const result1 = sh.test `echo -n`;
        assert.equal(result1, true);
    });
    
    it('supports stdout', () => {
        const result = sh `echo -n hoi; echo hoi`;
        // assert.equal(result, null);
    });
    
    it('supports echo -n', () => {
        const result = sh.val `echo -n blie`;
        assert.equal(result, "blie");
    });
    
    it('handles ENOENT gracefully', () => {
        try {
            sh.val `dontexistsorry`;
        } catch (e) {
            assert(e.code, e.stack);
            return;
        }
        throw new Error("Exception expected");
    });
    
    it('supports sh.json', () => {
        const result = sh.json `echo '{"foo":3}'`;
        assert.deepEqual(result, {foo: 3});
    });
    
    it('supports sh.vals', () => {
        const result = sh.vals`echo "1\n2"`;
        assert.deepEqual(result, [1,2]);
    });
    
    it('supports require("shellsync").sh', () => {
        const sh = require("./index").sh;
        sh(":");
    });
    
    it('supports require("shellsync")', () => {
        const sh = require("./index");
        sh(":");
    });
    
    it('supports import *', () => {
        assert.equal(typeof defaultExportSh, "function");
        defaultExportSh(":");
    });
    
    it('supports import sh', () => {
        assert.equal(typeof shExport, "function");
        shExport(":");
    });
    
    it('supports plain string arguments', () => {
        assert.equal(sh.val("echo hi"), "hi");
    });
});