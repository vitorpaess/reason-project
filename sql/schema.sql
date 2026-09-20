-- Rode este script uma vez no SQL Editor do Supabase (Project > SQL Editor > New query)
-- Cria as tabelas usadas pelo sistema de pairs trading.

create table if not exists precos_diarios (
    id            bigint generated always as identity primary key,
    ticker        text not null,
    data          date not null,
    preco_fechamento numeric not null,
    criado_em     timestamptz not null default now(),
    unique (ticker, data)
);

create index if not exists idx_precos_diarios_ticker_data
    on precos_diarios (ticker, data);

-- Posições realmente confirmadas pelo usuário no dashboard (botão "Confirmar
-- entrada" / "Confirmar saída"). Não é tocada pelo pipeline Python — só o
-- app Next.js escreve aqui.
create table if not exists posicoes_manuais (
    id            bigint generated always as identity primary key,
    par           text not null,
    data_entrada  date not null,
    z_entrada     numeric not null,
    direcao       text,
    data_saida    date,
    z_saida       numeric,
    criado_em     timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

-- No máximo uma posição aberta (data_saida nula) por par ao mesmo tempo.
create unique index if not exists idx_posicoes_manuais_aberta_unica
    on posicoes_manuais (par)
    where data_saida is null;

create index if not exists idx_posicoes_manuais_par
    on posicoes_manuais (par, data_entrada);

-- Lista de pares monitorados + setor — vem da planilha "Pares DATA",
-- sincronizada por collect_prices.py a cada execução. ticker_a/ticker_b
-- nunca têm hífen (tickers de bolsa), então o slug "TICKERA-TICKERB" usado
-- nas rotas do Next.js é sempre reversível de forma inequívoca.
create table if not exists pares_config (
    id            bigint generated always as identity primary key,
    ticker_a      text not null,
    ticker_b      text not null,
    setor         text not null,
    atualizado_em timestamptz not null default now(),
    unique (ticker_a, ticker_b)
);

-- Migração: uma versão anterior guardava o histórico INTEIRO de z-score
-- calculado (pares_zscore, 1 linha por par por dia) — com ~7,9 mil pares
-- isso estourou o limite de armazenamento do projeto (dezenas de milhões
-- de linhas em potencial). O histórico completo agora é recalculado sob
-- demanda na página de cada par (TypeScript, a partir do preço bruto em
-- precos_diarios, que é barato de guardar) — só o status MAIS RECENTE de
-- cada par fica persistido, em pares_status (1 linha por par, sempre
-- sobrescrita, nunca cresce). Rode isto uma vez pra migrar; seguro rodar
-- de novo (idempotente).
drop view if exists pares_status_atual;
drop table if exists pares_zscore;

create table if not exists pares_status (
    par                   text primary key,     -- ex: 'RKLB/PL'
    data                  date not null,
    z_score_63d           numeric,
    correlacao_movel_63d  numeric,
    spread                numeric,
    sinal                 text not null default 'nenhum',  -- 'entrada' | 'saida' | 'nenhum'
    direcao               text,                  -- ex: 'vender RKLB / comprar PL'
    atualizado_em         timestamptz not null default now()
);

-- Junta pares_config + o status mais recente (1:1 agora, não precisa mais
-- de lateral join) + se tem posição aberta — é o que alimenta a tabela do
-- dashboard (~7,9k pares) sem precisar de 1 query por par. Os limiares de
-- entrada/saída (1.20/0.50) NÃO entram aqui de propósito — ficam só em
-- lib/config.ts (TS) e config.py (Python), pra não duplicar a regra de
-- negócio em dois lugares.
create or replace view pares_status_atual as
select
    pc.ticker_a,
    pc.ticker_b,
    pc.ticker_a || '/' || pc.ticker_b as par,
    pc.setor,
    ps.data,
    ps.z_score_63d,
    abs(ps.z_score_63d) as z_abs,
    ps.correlacao_movel_63d,
    exists (
        select 1 from posicoes_manuais pm
        where pm.par = pc.ticker_a || '/' || pc.ticker_b and pm.data_saida is null
    ) as posicao_aberta
from pares_config pc
left join pares_status ps on ps.par = pc.ticker_a || '/' || pc.ticker_b;

-- Pares que o usuário marcou como favorito (botão de coração na página do
-- par) — só esses aparecem na sidebar esquerda. Estado único e global (o
-- dashboard não tem contas de usuário separadas), igual a posicoes_manuais.
create table if not exists pares_favoritos (
    par       text primary key,
    criado_em timestamptz not null default now()
);
