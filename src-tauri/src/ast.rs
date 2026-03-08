use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Program {
    pub name: String,
    pub variables: Vec<VarDecl>,
    pub statements: Vec<Statement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VarDecl {
    pub name: String,
    pub var_type: String,
    pub initial_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Statement {
    Assignment {
        target: String,
        value: Expression,
    },
    If {
        condition: Expression,
        then_block: Vec<Statement>,
        else_block: Option<Vec<Statement>>,
    },
    While {
        condition: Expression,
        body: Vec<Statement>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Expression {
    Binary {
        left: Box<Expression>,
        operator: String, // +, -, *, /, =, <>, <, >, <=, >=
        right: Box<Expression>,
    },
    Unary {
        operator: String, // -, NOT
        operand: Box<Expression>,
    },
    Call {
        function: String,
        arguments: Vec<(String, Expression)>,
    },
    Literal(String), // TRUE, FALSE, 123, 12.34
    Variable(String),
}
