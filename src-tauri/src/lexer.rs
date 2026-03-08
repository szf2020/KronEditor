use logos::Logos;
use std::fmt;

#[derive(Logos, Clone, Debug, PartialEq)]
#[logos(skip r"[ \t\n\f]+|//[^\n]*")] // Skip whitespace and comments
pub enum Token {
    // Keywords
    #[token("PROGRAM")]
    Program,
    #[token("END_PROGRAM")]
    EndProgram,
    #[token("VAR")]
    Var,
    #[token("END_VAR")]
    EndVar,
    #[token("IF")]
    If,
    #[token("THEN")]
    Then,
    #[token("ELSE")]
    Else,
    #[token("ELSIF")]
    Elsif,
    #[token("END_IF")]
    EndIf,
    #[token("WHILE")]
    While,
    #[token("DO")]
    Do,
    #[token("END_WHILE")]
    EndWhile,
    #[token("OR")]
    Or,
    #[token("AND")]
    And,
    #[token("NOT")]
    Not,
    #[token("MOD")]
    Mod,

    // Operators
    #[token(":=")]
    Assign,
    #[token(":")]
    Colon,
    #[token(";")]
    SemiColon,
    #[token("+")]
    Plus,
    #[token("-")]
    Minus,
    #[token("*")]
    Star,
    #[token("/")]
    Slash,
    #[token("=")]
    Equals,
    #[token("<>")]
    NotEquals,
    #[token("<")]
    Less,
    #[token("<=")]
    LessEquals,
    #[token(">")]
    Greater,
    #[token(">=")]
    GreaterEquals,
    #[token("(")]
    LParen,
    #[token(")")]
    RParen,
    #[token(",")]
    Comma,

    // Identifiers & Literals
    #[regex("[a-zA-Z_][a-zA-Z0-9_]*", |lex| lex.slice().to_string())]
    Identifier(String),

    #[regex(r"[0-9]+", |lex| lex.slice().to_string())]
    Integer(String),

    #[regex(r"[0-9]+\.[0-9]+", |lex| lex.slice().to_string())]
    Real(String),
    
    #[token("TRUE")]
    True,
    
    #[token("FALSE")]
    False,
}

impl fmt::Display for Token {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}
