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
  AG: {
    ticker: "AG",
    nome: "First Majestic Silver",
    bolsa: "NYSE",
    setor: "Basic Materials · Mineração de prata e ouro",
    dominio: "firstmajestic.com",
    website: "https://www.firstmajestic.com",
    cik: "0001308648",
    funcionarios: 4000,
    receitaTtmUsd: 1641153000,
    descricao:
      "Fundada em 1979 e sediada em Vancouver, Canadá, a First Majestic Silver é uma mineradora norte-americana focada em prata e ouro. Opera minas no México (San Dimas, Santa Elena, La Encantada, La Parrilla, Del Toro, San Martin e La Guitarra) e a mina de ouro Jerritt Canyon, em Nevada (EUA), além do projeto Springpole, no Canadá.",
  },
  EXK: {
    ticker: "EXK",
    nome: "Endeavour Silver",
    bolsa: "NYSE",
    setor: "Basic Materials · Mineração de prata e ouro",
    dominio: "edrsilver.com",
    website: "https://www.edrsilver.com",
    cik: "0001277866",
    funcionarios: 2411,
    receitaTtmUsd: 737200000,
    descricao:
      "Sediada em Vancouver, Canadá, e fundada em 1981 (com o nome atual desde 2004), a Endeavour Silver é uma mineradora de metais preciosos com operações no México e no Chile. Opera as minas de prata e ouro Guanaceví e Bolañitos, no México, e desenvolve os projetos Terronera e Parral, além de explorar depósitos no norte do Chile.",
  },
  CDE: {
    ticker: "CDE",
    nome: "Coeur Mining",
    bolsa: "NYSE",
    setor: "Basic Materials · Mineração de ouro e prata",
    dominio: "coeur.com",
    website: "https://www.coeur.com",
    cik: "0000215466",
    funcionarios: 2620,
    receitaTtmUsd: 3171198000,
    descricao:
      "Sediada em Chicago, Illinois, e fundada em 1928 (como Coeur d'Alene Mines, rebatizada Coeur Mining em 2013), a empresa explora e produz ouro, prata, zinco e chumbo nos Estados Unidos, Canadá e México, com minas como Palmarejo, Rochester, Kensington, Wharf e Silvertip.",
  },
  FSM: {
    ticker: "FSM",
    nome: "Fortuna Mining",
    bolsa: "NYSE",
    setor: "Basic Materials · Mineração de ouro e prata",
    dominio: "fortunamining.com",
    website: "https://www.fortunamining.com",
    cik: "0001341335",
    funcionarios: 4294,
    receitaTtmUsd: 1182487000,
    descricao:
      "Fundada em 1990 e sediada em Vancouver, Canadá, a Fortuna Mining (historicamente Fortuna Silver Mines) produz ouro e prata em cinco países — Argentina, Burkina Faso, México, Peru e Costa do Marfim —, com minas como Caylloma, San Jose, Lindero, Yaramoko e Séguéla.",
  },
};
