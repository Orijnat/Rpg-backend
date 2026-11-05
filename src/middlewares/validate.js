import { ZodError } from "zod";

export function validar(schema, origem = "body") {
  return (req, res, next) => {
    const resultado = schema.safeParse(req[origem]);
    if (!resultado.success) {
      return res.status(422).json({
        status: "error",
        statusCode: 422,
        code: "VALIDATION_FAILED",
        message: "Dados inválidos enviados na requisição.",
        errors: resultado.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    req[origem] = resultado.data;
    return next();
  };
}

export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(422).json({
      status: "error",
      statusCode: 422,
      code: "VALIDATION_FAILED",
      message: "Dados inválidos enviados na requisição.",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      error: "Payload excede o limite permitido.",
      code: "PAYLOAD_TOO_LARGE",
    });
  }
  console.error("Erro interno ao processar requisição.");
  return res.status(500).json({
    error: "Erro interno do servidor.",
    code: "INTERNAL_SERVER_ERROR",
  });
}
