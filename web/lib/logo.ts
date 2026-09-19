// URL pública do logo.dev — usa a publishable key (feita pra ser exposta
// no HTML/navegador, igual a uma pk_ do Stripe). A secret key não entra
// aqui: não precisamos da API de busca deles, já sabemos o domínio de
// cada empresa (lib/companies.ts).
export function logoUrl(dominio: string): string {
  const token = process.env.LOGO_DEV_PUBLISHABLE_KEY;
  return `https://img.logo.dev/${dominio}?token=${token}&size=64&format=png`;
}
