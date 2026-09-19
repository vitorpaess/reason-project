// Informações básicas das empresas que compõem os pares — estáticas
// porque mudam raramente, evitando chamadas à API a cada carregamento
// de página. Nome/setor/indústria/domínio vieram do COMPANY_OVERVIEW
// (Alpha Vantage) na implementação desse painel, não de memória.

export type CompanyInfo = {
  ticker: string;
  nome: string;
  bolsa: string;
  setor: string;
  dominio: string; // usado pra montar a URL do logo.dev
};

export const COMPANIES: Record<string, CompanyInfo> = {
  RKLB: {
    ticker: "RKLB",
    nome: "Rocket Lab USA",
    bolsa: "NASDAQ",
    setor: "Industrials · Aeroespacial e defesa",
    dominio: "rocketlabcorp.com",
  },
  PL: {
    ticker: "PL",
    nome: "Planet Labs PBC",
    bolsa: "NYSE",
    setor: "Industrials · Aeroespacial e defesa",
    dominio: "planet.com",
  },
  RPD: {
    ticker: "RPD",
    nome: "Rapid7",
    bolsa: "NASDAQ",
    setor: "Tecnologia · Software de infraestrutura",
    dominio: "rapid7.com",
  },
  TENB: {
    ticker: "TENB",
    nome: "Tenable Holdings",
    bolsa: "NASDAQ",
    setor: "Tecnologia · Software de infraestrutura",
    dominio: "tenable.com",
  },
};
