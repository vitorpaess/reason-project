-- Rode este script uma vez no SQL Editor do Supabase (Project > SQL Editor > New query)
-- Cria as duas tabelas usadas pelo sistema de pairs trading.

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

create table if not exists pares_zscore (
    id                        bigint generated always as identity primary key,
    par                       text not null,       -- ex: 'RKLB/PL'
    data                      date not null,
    z_score                   numeric,
    correlacao_movel_63d      numeric,
    spread                    numeric,
    sinal                     text not null default 'nenhum',  -- 'entrada' | 'saida' | 'nenhum'
    direcao                   text,                 -- ex: 'vender RKLB / comprar PL'
    criado_em                 timestamptz not null default now(),
    unique (par, data)
);

create index if not exists idx_pares_zscore_par_data
    on pares_zscore (par, data);

-- Posições realmente confirmadas pelo usuário no dashboard (botão "Confirmar
-- entrada" / "Confirmar saída"). Separada de pares_zscore de propósito: essa
-- tabela é recalculada inteira todo dia pelo compute_zscore.py, e não deve
-- ser tocada por ela — só o app Next.js escreve aqui.
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
