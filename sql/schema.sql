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

-- z_score_63d/correlacao_movel_63d = cálculo oficial (janela móvel de 63
-- dias) — o único que decide sinal/direcao. z_score_expansivo/
-- correlacao_expansiva = cálculo histórico (janela expansiva, todos os
-- dias desde o início) — só para o gráfico e a tabela de oportunidades,
-- nunca decide sinal.
create table if not exists pares_zscore (
    id                        bigint generated always as identity primary key,
    par                       text not null,       -- ex: 'RKLB/PL'
    data                      date not null,
    z_score_63d               numeric,
    z_score_expansivo         numeric,
    correlacao_movel_63d      numeric,
    correlacao_expansiva      numeric,
    spread                    numeric,
    sinal                     text not null default 'nenhum',  -- 'entrada' | 'saida' | 'nenhum'
    direcao                   text,                 -- ex: 'vender RKLB / comprar PL'
    criado_em                 timestamptz not null default now(),
    unique (par, data)
);

create index if not exists idx_pares_zscore_par_data
    on pares_zscore (par, data);

-- Migração: se a tabela pares_zscore já existia com a coluna antiga
-- "z_score" (cálculo único, sem separar 63d/expansivo), rode isto uma
-- vez para adaptá-la ao novo formato. Seguro rodar de novo (idempotente).
do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_name = 'pares_zscore' and column_name = 'z_score'
    ) then
        execute 'alter table pares_zscore rename column z_score to z_score_63d';
    end if;
end $$;

alter table pares_zscore add column if not exists z_score_expansivo numeric;
alter table pares_zscore add column if not exists correlacao_expansiva numeric;

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
