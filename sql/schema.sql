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
