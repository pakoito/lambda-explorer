// might be cool to do this within lib/lambda.
import {
  parseExtendedSyntax,
  getFreeVars,
  replace,
  toNormalForm,
} from '../lib/lambda';

import astToMetadata from './astToMetadata';

// There's a better way of doing this I swear.
// Might want to make a whole "Execution" object
class ExecutionContext {
  definedVariables = {};

  getResolvableVariables(ast){
    // holy fuck there is so much badness in here.
    return getFreeVars(ast).map(token => token.name).filter(
      name => this.definedVariables[name] !== undefined
    );
  }

  getUnresolvableVariables(ast){
    return getFreeVars(ast).map(token => token.name).filter(
      name => this.definedVariables[name] === undefined
    )
  }

  defineVariableFromString(name, string){
    const ast = parseTerm(string);
    this.defineVariable(name, ast);
  }

  // Defined variables must contain no unresolvableVariables
  // This is so that variable resolution is guaranteed to halt at some point.
  defineVariable(name, ast){
    if(this.getUnresolvableVariables(ast).length > 0){
      const unresolvables = this.getUnresolvableVariables(ast).join(', ');
      throw 'Name Error: Expression contains free variables ' + unresolvables + '. Assigned values cannot have free variables in this REPL.'
    }
    this.definedVariables[name] = ast;
  }

  clearVariables(){
    this.definedVariables = {};
  }

  // string => computationData
  // a computationData is loosely defined right now-- kind of a grab bag of an object.
  evaluate(text){
    let ast, metadata;
    let assignment = false, lhs;
    try {
      // lambda + assignment
      ast = parseExtendedSyntax(text);
      if (ast.type === 'assignment') {
        assignment = true;
        lhs = ast.lhs;
        ast = ast.rhs;
      }
      ast = this.resolveVariables(ast);
      metadata = astToMetadata(ast);
      // it would be sweet to do the check for whether we can define the variable
      // before we actually do all the computation associated with it.
      if (assignment) {
        this.defineVariable(lhs, metadata.normalForm);
      }
    } catch(error){
      // we pass AST, executionContext because in the case that we parsed
      // successfully, we still want to be able to use it in win conditions
      return { text, error, ast, executionContext: this };
    }

    return {
      text,
      lhs,
      ast,
      // Might not want to put this in computation,
      // does a computation make sense separate from it's executionContext?
      executionContext: this,
      ...metadata,
    };
  }

  // This does the same thing as evaluate, except spawns off a webworker to do so, returning a promise
  evaluateAsync(){
    // stub...
  }

  // ast => ast
  resolveVariables(ast){
    let currentAst = ast;
    // this could be much faster. Let's do clever stuff after this works.
    let resolvableVars = this.getResolvableVariables(ast);
    while(resolvableVars.length > 0){
      const toResolve = resolvableVars[0];
      currentAst = replace(
        toResolve,
        this.definedVariables[toResolve],
        currentAst
      );
      resolvableVars = this.getResolvableVariables(currentAst);
    }
    return currentAst;
  }
}

export default ExecutionContext;
