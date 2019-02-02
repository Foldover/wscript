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
    default: throw new Error("I don't know how to evaluate " + expr.type);
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
    case "+": return num(a) + num(b);
    case "-": return num(a) - num(b);
    case "*": return num(a) * num(b);
    case "/": return num(a) / div(b);
    case "%": return num(a) % div(b);
    case "&&": return a !== false && b;
    case "||": return a !== false ? a : b;
    case "<": return num(a) < num(b);
    case ">": return num(a) > num(b);
    case "<=": return num(a) <= num(b);
    case ">=": return num(a) >= num(b);
    case "==": return a === b;
    case "!=": return a !== b;
  }
  throw new Error("Can't apply operator " + op);
}

function makeLambda(env, expr) {
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
var code = "sum = lambda(x, y) x + y; print(sum(2, 3));";

// remember, parse takes a TokenStream which takes an InputStream
var ast = parse(TokenStream(InputStream(code)));

// create the global environment
var globalEnv = new Environment();

// define the "print" primitive function
globalEnv.define("print", function(txt){
  console.log(txt);
});

// run the evaluator
evaluate(ast, globalEnv); // will print 5