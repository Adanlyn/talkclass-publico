import { ActionIcon, Group, NumberInput, TextInput } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';

type Opt = { texto: string; valor: number };
type Props = { value: Opt[]; onChange: (v: Opt[]) => void };

export default function OptionEditor({ value, onChange }: Props) {
  function add() { onChange([...(value || []), { texto: '', valor: 0 }]); }
  function set(i: number, patch: Partial<Opt>) {
    const arr = [...value]; arr[i] = { ...arr[i], ...patch }; onChange(arr);
  }
  function del(i: number) {
    const arr = [...value]; arr.splice(i, 1); onChange(arr);
  }
  return (
    <div>
      {value.map((o, i) => (
        <Group key={i} mb="xs" align="center">
          <TextInput placeholder="Texto" value={o.texto} onChange={(e) => set(i, { texto: e.currentTarget.value })} w={340}/>
          <NumberInput placeholder="Valor" value={o.valor} onChange={(v) => set(i, { valor: Number(v ?? 0) })} w={120}/>
          <ActionIcon color="red" variant="light" onClick={() => del(i)} aria-label="Excluir"><IconTrash size={16}/></ActionIcon>
        </Group>
      ))}
      <ActionIcon variant="light" onClick={add} aria-label="Adicionar"><IconPlus size={16}/></ActionIcon>
    </div>
  );
}
