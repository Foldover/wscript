const parse = require("./parser.js");
const TokenStream = require("./lexer.js");
const InputStream = require("./input-stream.js");

function Environment(parent) {
    this.vars = Object.create(parent ? parent.vars : null);
    this.parent = parent;
}

Environment.prototype = {
    extend: function () {
        return new Environment(this);
    },
    lookup: function (name) {
        let scope = this;
        while (scope) {
            if (Object.prototype.hasOwnProperty.call(scope.vars, name)) {
                return scope;
            }
            scope = scope.parent;
        }
    },
    get: function (name) {
        if (name in this.vars) {
            return this.vars[name];
        }
        throw new Error("Undefined variable " + name);
    },
    set: function (name, value) {
        const scope = this.lookup(name);
        if (!scope && this.parent) {
            throw new Error("Undefined variable " + name);
        }
        return (scope || this).vars[name] = value;
    },
    define: function (name, value) {
        return this.vars[name] = value;
    }
};

function evaluate(expr, env) {
    switch (expr.type) {
        case "number":
        case "string":
        case "bool":
            return expr.value;
        case "identifier":
            return env.get(expr.value);
        case "assign":
            if (expr.left.type !== "identifier") {
                throw new Error("Cannot assign to " + JSON.stringify(expr.left));
            }
            return env.set(expr.left.value, evaluate(expr.right, env));
        case "binary":
            return applyOperator(expr.operator, evaluate(expr.left, env), evaluate(expr.right, env));
        case "lambda":
            return makeLambda(env, expr);
        case "if":
            const cond = evaluate(expr.cond, env);
            if (cond !== false) return evaluate(expr.then, env);
            return expr.else ? evaluate(expr.else, env) : false;
        case "program":
            let val = false;
            expr.program.forEach(function (expr) {
                val = evaluate(expr, env);
            });
            return val;
        case "call":
            const func = evaluate(expr.func, env);
            return func.apply(null, expr.args.map(function (arg) {
                return evaluate(arg, env);
            }));
        case "let":
            expr.vars.forEach(function (v) {
                const scope = env.extend();
                scope.define(v.name, v.def ? evaluate(v.def, env) : false);
                env = scope;
            });
            return evaluate(expr.body, env);
        default:
            throw new Error("I don't know how to evaluate " + expr.type);
    }
}

function applyOperator(op, a, b) {
    function num(x) {
        if (typeof x !== "number") {
            throw new Error("Expected number but got " + x);
        }
        return x;
    }

    function div(x) {
        if (num(x) === 0) {
            throw new Error("Divide by zero");
        }
        return x;
    }

    switch (op) {
        case "+":
            return num(a) + num(b);
        case "-":
            return num(a) - num(b);
        case "*":
            return num(a) * num(b);
        case "/":
            return num(a) / div(b);
        case "%":
            return num(a) % div(b);
        case "&&":
            return a !== false && b;
        case "||":
            return a !== false ? a : b;
        case "<":
            return num(a) < num(b);
        case ">":
            return num(a) > num(b);
        case "<=":
            return num(a) <= num(b);
        case ">=":
            return num(a) >= num(b);
        case "==":
            return a === b;
        case "!=":
            return a !== b;
    }
    throw new Error("Can't apply operator " + op);
}

function makeLambda(env, expr) {
    if (expr.name) {
        env = env.extend();
        env.define(expr.name, lambda);
    }
    function lambda() {
        const names = expr.vars;
        const scope = env.extend();
        for (let i = 0; i < names.length; ++i) {
            scope.define(names[i], i < arguments.length ? arguments[i] : false);
        }
        return evaluate(expr.body, scope);
    }
    return lambda;
}

// some test code here
const code = `
cons = lambda(a, b) lambda(f) f(a, b);
car = lambda(cell) cell(lambda(a, b) a);
cdr = lambda(cell) cell(lambda(a, b) b);
NIL = lambda(f) f(NIL, NIL);
set-car! = lambda(cell, val) cell("set", 0, val);
set-cdr! = lambda(cell, val) cell("set", 1, val);

println(let loop (n = 100)
          if n > 0 then n + loop(n - 1)
                   else 0);

let (x = 2, y = x + 1, z = x + y)
  println(x + y + z);

# errors out, the vars are bound to the let body
# print(x + y + z);

let (x = 10) {
  let (x = x * 2, y = x * x) {
    println(x);  ## 20
    println(y);  ## 400
  };
  println(x);  ## 10
};
 `;

const code2 = `
printRange = lambda(a, b)
                 if a < b then printRange(a + 1, b)
                 else a;
println(printRange(1, 10));
`;


// remember, parse takes a TokenStream which takes an InputStream
const ast = parse(TokenStream(InputStream(code2)));

// create the global environment
const globalEnv = new Environment();

// define the "print" primitive function
globalEnv.define("print", function (txt) {
    console.log(txt);
});

globalEnv.define("println", function (txt) {
    console.log(txt + "\n");
});

// run the evaluator
evaluate(ast, globalEnv); // will print 5