import * as assert from "assert";
import { createShell, escape, unescaped } from "./index";

describe('#escape', () => {
    it('supports strings without args', () => {
        const escaped = escape(`foo "bar"`);
        assert.equal(escaped, `'foo "bar"'`);
    });
    
    it('supports strings without args in template form', () => {
        const escaped = escape`foo "bar"`;
        assert.equal(escaped, `foo "bar"`);
    });
    
    it('supports tagged templates', () => {
        const bar = "bar";
        const baz = '"baz"';
        const escaped = escape`foo ${bar} ${baz}`;
        assert.equal(escaped, `foo bar '"baz"'`);
    });
    
    it('supports string arguments', () => {
        const bar = "bar";
        const baz = '"baz"';
        const escaped = escape("foo", bar, baz, null as any, undefined);
        assert.equal(escaped, `foo bar '"baz"' '' ''`);
    });
    
    it('supports unescaped arguments', () => {
        const args = "bar baz";
        const escaped = escape`foo ${unescaped(args)} ${unescaped()}`;
        assert.equal(escaped, `foo bar baz `);
    });

    it('supports falsy arguments', () => {
        const escaped = escape`foo ${false} ${undefined} ${0}`;
        assert.equal(escaped, `foo false '' 0`);
    });

    it('supports optional typed values', () => {
        interface Foo {
            opt?: string
        }
        const foo: Foo = { opt: "opt "};
        escape `foo.opt = ${foo.opt}`
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
    
    it('supports .test()', () => {
        const result2 = sh.test `exit 0`;
        assert.equal(result2, true);
        const result1 = sh.test `exit 1`;
        assert.equal(result1, false);
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
            return;
        }
        throw new Error("Exception expected");
    });
    
    it('supports sh.json', () => {
        const result = sh.json `echo '{"foo":3}'`;
        assert.deepEqual(result, {foo: 3});
    });
    
    it('supports sh.vals', () => {
        const result = sh.vals `echo "1\n2"`;
        assert.deepEqual(result, [1,2]);
    });
});