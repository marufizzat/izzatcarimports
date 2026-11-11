// Roda antes de todo arquivo de teste (vitest.config.ts, setupFiles).
//
// Vários testes daqui são contas longas, sem pausa (a busca em centenas de consultas, o estoque inteiro). O vitest conversa
// com o processo de cada arquivo por mensagens e desiste depois de 60 s sem resposta: "Timeout calling onTaskUpdate". Ele
// sai com erro MESMO COM TODOS OS TESTES VERDES, e o robô não publica (medido em 11/11/2026: arquivo de 80 s de conta
// seguida, com esta pausa passa, sem ela sai com erro). Depois de cada teste, uma volta no relógio do Node para as
// mensagens passarem. Não muda o resultado de teste nenhum. Um teste SOZINHO não pode passar de 60 s de conta seguida.
import { afterEach } from 'vitest';

afterEach(() => new Promise<void>((ok) => { setTimeout(ok, 0); }));
