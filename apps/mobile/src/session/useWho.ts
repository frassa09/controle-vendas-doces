import type { MemberRef } from '@cvd/core';
import { useSession } from './SessionProvider';

/** Como mostrar quem registrou algo: "você", o e-mail do membro ou quem saiu da loja. */
export function useWho(): (member: MemberRef) => string {
  const session = useSession();
  const myId = session.state.status === 'ready' ? session.state.member.id : null;
  return (member) => (member.id === myId ? 'você' : (member.email ?? 'um membro que saiu da loja'));
}
