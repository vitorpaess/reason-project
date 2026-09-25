"use client";

import { useMemo, useState } from "react";
import { PeriodFilter } from "@/components/PeriodFilter";
import { rangeStartDate, type RangeKey } from "@/lib/date-ranges";
import { colors } from "@/lib/theme";
import { formatPct } from "@/lib/format";
import type { Operacao } from "@/lib/operacoes-historicas";

function diasEntre(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);
}

const inputClass =
  "w-36 rounded-md border border-border-strong bg-surface-raised px-3 py-1.5 text-sm text-ink-secondary outline-none focus:border-series";

/**
 * Simula, sobre as operações históricas REAIS de todos os pares (lib/
 * operacoes-historicas.ts), quanto retorno uma garantia teria trazido.
 *
 * Regra de garantia: garantia = metade da exposição total (compra + venda
 * a descoberto) de UMA operação dólar-neutro — ou seja, garantia por
 * operação = valor de UMA perna. Com uma garantia total e um número
 * máximo de operações simultâneas, cada operação usa
 * tamanhoPorOperacao = garantia ÷ máximo (tamanho igual pra todas).
 *
 * A simulação percorre as operações em ordem de entrada; uma operação só
 * "cabe" se já existe um slot livre (uma operação anterior, do MESMO ou de
 * outro par, já tiver saído) — do contrário o sinal é contado como
 * "perdido por falta de garantia livre", não substitui nada. Simplificações
 * deliberadas: a garantia fica fixa (lucro realizado não é reinvestido
 * automaticamente pra abrir mais posições) e não há limite de concentração
 * por setor/ticker — ver texto no rodapé do card.
 */
export function GarantiaCalculadora({ operacoes }: { operacoes: Operacao[] }) {
  const [range, setRange] = useState<RangeKey>("5A");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [garantia, setGarantia] = useState(100000);
  const [maxSimultaneas, setMaxSimultaneas] = useState(10);

  const dataMin = operacoes.length > 0 ? operacoes[0].dataEntrada : null;
  const dataMax = useMemo(() => {
    if (operacoes.length === 0) return null;
    return operacoes.reduce((max, o) => (o.dataSaida > max ? o.dataSaida : max), operacoes[0].dataSaida);
  }, [operacoes]);

  const start = range === "CUSTOM" ? customStart || dataMin : dataMax ? rangeStartDate(range, dataMax) : null;
  const end = range === "CUSTOM" ? customEnd || dataMax : null;

  const operacoesNoPeriodo = useMemo(() => {
    const filtradas = operacoes.filter(
      (o) => (!start || o.dataEntrada >= start) && (!end || o.dataEntrada <= end)
    );
    // Empate na mesma data de entrada: prioriza |z| mais extremo (sinal mais
    // forte) quando a garantia for escassa naquele momento — critério
    // simples e determinístico, não é o score do ranking (não recalculado
    // aqui pra manter a simulação rápida no navegador).
    return [...filtradas].sort((a, b) => {
      if (a.dataEntrada !== b.dataEntrada) return a.dataEntrada < b.dataEntrada ? -1 : 1;
      return Math.abs(b.zEntrada) - Math.abs(a.zEntrada);
    });
  }, [operacoes, start, end]);

  const resultado = useMemo(() => {
    const tamanhoPorOperacao = maxSimultaneas > 0 ? garantia / maxSimultaneas : 0;
    const saidasAbertas: string[] = [];
    let realizadas = 0;
    let sucessos = 0;
    let perdidasPorGarantia = 0;
    let resultadoAcumulado = 0;
    let piorOperacao: Operacao | null = null;

    for (const op of operacoesNoPeriodo) {
      for (let i = saidasAbertas.length - 1; i >= 0; i--) {
        if (saidasAbertas[i] <= op.dataEntrada) saidasAbertas.splice(i, 1);
      }
      if (saidasAbertas.length >= maxSimultaneas) {
        perdidasPorGarantia++;
        continue;
      }
      saidasAbertas.push(op.dataSaida);
      realizadas++;
      if (op.resultado === "sucesso") sucessos++;
      resultadoAcumulado += op.retornoLiquidoPct * tamanhoPorOperacao;
      if (piorOperacao === null || op.retornoLiquidoPct < piorOperacao.retornoLiquidoPct) piorOperacao = op;
    }

    const inicioEfetivo = start ?? dataMin;
    const fimEfetivo = end ?? dataMax;
    const diasPeriodo =
      inicioEfetivo && fimEfetivo ? Math.max(1, diasEntre(inicioEfetivo, fimEfetivo)) : null;
    const retornoSobreGarantia = garantia > 0 ? resultadoAcumulado / garantia : null;
    const retornoAnualizado =
      retornoSobreGarantia !== null && diasPeriodo !== null
        ? retornoSobreGarantia * (365 / diasPeriodo)
        : null;

    return {
      tamanhoPorOperacao,
      realizadas,
      perdidasPorGarantia,
      sucessos,
      resultadoAcumulado,
      retornoSobreGarantia,
      retornoAnualizado,
      diasPeriodo,
      piorOperacao,
    };
  }, [operacoesNoPeriodo, garantia, maxSimultaneas, start, end, dataMin, dataMax]);

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-1 text-sm font-semibold text-ink-secondary">Calculadora de garantia</h2>
      <p className="mb-4 text-[11px] text-ink-muted">
        Simula, sobre as {operacoes.length.toLocaleString("pt-BR")} operações históricas reais que teriam
        passado nos mesmos filtros de qualidade do ranking (correlação, quebra estrutural, hedge ratio —
        reavaliados no dia de cada entrada, sem olhar pra frente), quanto retorno uma garantia teria trazido
        — considerando que a garantia exigida é metade da exposição total (compra + venda a descoberto) de
        cada operação.
      </p>

      <PeriodFilter
        range={range}
        onRangeChange={setRange}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
        dataMin={dataMin}
        dataMax={dataMax}
      />

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Garantia disponível (R$)
          <input
            type="number"
            min={0}
            step={1000}
            value={garantia}
            onChange={(e) => setGarantia(Math.max(0, Number(e.target.value) || 0))}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Máx. operações simultâneas
          <input
            type="number"
            min={1}
            step={1}
            value={maxSimultaneas}
            onChange={(e) => setMaxSimultaneas(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            className={inputClass}
          />
        </label>
        <div className="flex flex-col gap-1 text-xs text-ink-muted">
          Tamanho por operação (1 perna)
          <div className="w-36 rounded-md border border-border bg-surface px-3 py-1.5 text-sm tabular-nums text-ink-secondary">
            {resultado.tamanhoPorOperacao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <ResultCard
          label="Resultado acumulado"
          valor={resultado.resultadoAcumulado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          cor={resultado.resultadoAcumulado >= 0 ? colors.statusGood : colors.statusCritical}
        />
        <ResultCard
          label="Retorno sobre a garantia"
          valor={formatPct(resultado.retornoSobreGarantia, 1)}
          cor={
            resultado.retornoSobreGarantia === null
              ? colors.inkMuted
              : resultado.retornoSobreGarantia >= 0
                ? colors.statusGood
                : colors.statusCritical
          }
        />
        <ResultCard
          label="Retorno anualizado (linear)"
          valor={formatPct(resultado.retornoAnualizado, 1)}
          cor={
            resultado.retornoAnualizado === null
              ? colors.inkMuted
              : resultado.retornoAnualizado >= 0
                ? colors.statusGood
                : colors.statusCritical
          }
        />
        <ResultCard
          label="Operações realizadas"
          valor={resultado.realizadas.toLocaleString("pt-BR")}
          cor={colors.inkPrimary}
        />
        <ResultCard
          label="Taxa de sucesso"
          valor={resultado.realizadas > 0 ? `${((resultado.sucessos / resultado.realizadas) * 100).toFixed(1)}%` : "—"}
          cor={colors.inkPrimary}
        />
        <ResultCard
          label="Sinais perdidos (sem garantia livre)"
          valor={resultado.perdidasPorGarantia.toLocaleString("pt-BR")}
          cor={colors.statusWarning}
        />
      </div>

      {resultado.piorOperacao && (
        <p className="mt-3 text-[11px] text-ink-muted">
          Pior operação no período: {resultado.piorOperacao.par}, entrada em{" "}
          {resultado.piorOperacao.dataEntrada} —{" "}
          <span style={{ color: colors.statusCritical }}>
            {formatPct(resultado.piorOperacao.retornoLiquidoPct, 1)}
          </span>{" "}
          sobre o tamanho da operação (
          {(resultado.piorOperacao.retornoLiquidoPct * resultado.tamanhoPorOperacao).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
          ).
        </p>
      )}

      <p className="mt-4 text-[10px] leading-relaxed text-ink-muted">
        Simplificações: a garantia fica fixa no valor informado (lucro realizado não é reinvestido
        automaticamente pra abrir mais posições); não há limite de concentração por setor ou ticker — só
        pelo número máximo de operações simultâneas; custos usam as mesmas estimativas do ranking (comissão,
        slippage, aluguel — ver tooltip da coluna Custo). Não é o cálculo oficial de margem da sua
        corretora/B3, que costuma considerar correlação entre posições e pode exigir mais ou menos que 50%
        dependendo do ativo.
      </p>
    </div>
  );
}

function ResultCard({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div className="rounded-lg bg-surface-raised px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-1 text-base font-bold tabular-nums" style={{ color: cor }}>
        {valor}
      </div>
    </div>
  );
}
