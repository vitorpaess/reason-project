// Informações das empresas que compõem os pares — estáticas porque mudam
// raramente, evitando chamadas à API a cada carregamento de página. Nome/
// setor/domínio/descrição/funcionários vieram do COMPANY_OVERVIEW (Alpha
// Vantage) e do profile-symbol (FMP) na implementação desse painel, não
// de memória.

export type CompanyInfo = {
  ticker: string;
  nome: string;
  bolsa: string;
  setor: string;
  dominio: string; // usado pra montar a URL do logo.dev
  website: string;
  cik: string; // pro link de filings na SEC (EDGAR)
  funcionarios: number;
  receitaTtmUsd: number;
  descricao: string;
};

export const COMPANIES: Record<string, CompanyInfo> = {
  RKLB: {
    ticker: "RKLB",
    nome: "Rocket Lab USA",
    bolsa: "NASDAQ",
    setor: "Industrials · Aeroespacial e defesa",
    dominio: "rocketlabcorp.com",
    website: "https://rocketlabcorp.com",
    cik: "0001819994",
    funcionarios: 2600,
    receitaTtmUsd: 769146000,
    descricao:
      "Sediada em Long Beach, Califórnia, a Rocket Lab USA foi fundada em 2006 e oferece um conjunto completo de serviços e equipamentos espaciais, principalmente para os setores aeroespacial e de defesa. Suas operações incluem lançamentos orbitais, engenharia e construção de espaçonaves e gestão de constelações em órbita. O foguete Electron, de pequeno porte, e a plataforma de satélites Photon são seus principais produtos, enquanto o Neutron, um veículo de lançamento maior, está em desenvolvimento.",
  },
  PL: {
    ticker: "PL",
    nome: "Planet Labs PBC",
    bolsa: "NYSE",
    setor: "Industrials · Aeroespacial e defesa",
    dominio: "planet.com",
    website: "https://www.planet.com",
    cik: "0001836833",
    funcionarios: 973,
    receitaTtmUsd: 378278000,
    descricao:
      "Fundada em 2010 e sediada em São Francisco, a Planet Labs opera uma extensa constelação de satélites dedicada a capturar dados geoespaciais do planeta com alta frequência, acessados por uma plataforma online própria. Atende clientes em agricultura, cartografia, silvicultura, finanças e seguros, além de órgãos governamentais federais, estaduais e municipais.",
  },
  RPD: {
    ticker: "RPD",
    nome: "Rapid7",
    bolsa: "NASDAQ",
    setor: "Tecnologia · Software de infraestrutura",
    dominio: "rapid7.com",
    website: "https://www.rapid7.com",
    cik: "0001560327",
    funcionarios: 2613,
    receitaTtmUsd: 855922000,
    descricao:
      "Fundada em 2000 e sediada em Boston, a Rapid7 oferece uma plataforma de cibersegurança nativa em nuvem voltada à detecção e resposta a incidentes (InsightIDR), segurança em nuvem (InsightCloudSec), gestão de vulnerabilidades (InsightVM) e segurança de aplicações (InsightAppSec), além do Metasploit, ferramenta de teste de invasão amplamente conhecida no setor.",
  },
  TENB: {
    ticker: "TENB",
    nome: "Tenable Holdings",
    bolsa: "NASDAQ",
    setor: "Tecnologia · Software de infraestrutura",
    dominio: "tenable.com",
    website: "https://www.tenable.com",
    cik: "0001660280",
    funcionarios: 1995,
    receitaTtmUsd: 1043539000,
    descricao:
      "Fundada em 2002 e sediada em Columbia, Maryland, a Tenable é especializada em identificar e gerenciar a exposição a riscos cibernéticos. Sua plataforma Tenable One centraliza a descoberta e priorização de vulnerabilidades em nuvem, redes, Active Directory e ambientes de tecnologia operacional (OT), incluindo as ferramentas Nessus, referência no mercado de avaliação de vulnerabilidades.",
  },
  ALGT: {
    ticker: "ALGT",
    nome: "Allegiant Travel Company",
    bolsa: "NASDAQ",
    setor: "Industrials · Companhias aéreas",
    dominio: "allegiantair.com",
    website: "https://www.allegiantair.com",
    cik: "0001362468",
    funcionarios: 8484,
    receitaTtmUsd: 2894042000,
    descricao:
      "Fundada em 1997 e sediada em Las Vegas, Nevada, a Allegiant é uma companhia aérea de lazer voltada a moradores de cidades menores e pouco atendidas nos Estados Unidos, oferecendo voos diretos e pouco frequentes até destinos turísticos populares. Além das passagens, gera receita com bagagem despachada, assentos preferenciais, seguro-viagem e fretamentos sob contrato.",
  },
  CPA: {
    ticker: "CPA",
    nome: "Copa Holdings",
    bolsa: "NYSE",
    setor: "Industrials · Companhias aéreas",
    dominio: "copaair.com",
    website: "https://www.copaair.com",
    cik: "0001345105",
    funcionarios: 8565,
    receitaTtmUsd: 3987794000,
    descricao:
      "Fundada em 1947 e sediada na Cidade do Panamá, a Copa Holdings controla a Copa Airlines, companhia aérea que conecta América Central, América do Sul, América do Norte e o Caribe através do hub de conexões no Aeroporto Internacional de Tocumen, no Panamá.",
  },
  TRMB: {
    ticker: "TRMB",
    nome: "Trimble",
    bolsa: "NASDAQ",
    setor: "Tecnologia · Hardware e software de posicionamento",
    dominio: "trimble.com",
    website: "https://www.trimble.com",
    cik: "0000864749",
    funcionarios: 11500,
    receitaTtmUsd: 3782900000,
    descricao:
      "Fundada em 1978 e sediada em Westminster, Colorado (originalmente Trimble Navigation), a Trimble desenvolve tecnologia de posicionamento e software para os setores de construção, agricultura e transporte — incluindo ferramentas de projeto e gestão de obras (BIM/ERP), sistemas de agricultura de precisão e soluções de gestão de frotas para transporte rodoviário de carga.",
  },
  FICO: {
    ticker: "FICO",
    nome: "FICO",
    bolsa: "NYSE",
    setor: "Tecnologia · Análise de crédito e decisão",
    dominio: "fico.com",
    website: "https://www.fico.com",
    cik: "0000814547",
    funcionarios: 3876,
    receitaTtmUsd: 2393575000,
    descricao:
      "Fundada em 1956 e sediada em Bozeman, Montana, a FICO (Fair Isaac Corporation) fornece software de análise e tomada de decisão para empresas, dividida em dois segmentos: Software, com a plataforma FICO Platform para gestão de risco, fraude e relacionamento com clientes; e Scores, incluindo o tradicional escore de crédito FICO usado por instituições financeiras e consumidores (via myFICO.com).",
  },
};
