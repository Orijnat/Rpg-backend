# Modelo de dados do sistema

## Perfis e segurança

| Tabela | Campo | Tipo | Uso |
| --- | --- | --- | --- |
| `users` | `perfil` | `jogador` ou `mestre` | Perfil canônico de acesso |
| `users` | `role` | `player` ou `master` | Compatibilidade com clientes antigos |
| `users` | `dados_mestre` | `JSONB` | Sessão, NPCs, iniciativa e mapas privados |

Novos usuários são criados como `jogador`. A promoção para `mestre` deve ser feita
por operação administrativa no banco. A API aplica a autorização antes de acessar
personagens e dados da campanha.

## Ficha do personagem

A tabela `characters` mantém os dados simples em colunas e coleções flexíveis em
`JSONB`. Os nomes persistidos em português usam `snake_case` quando são campos
compostos:

- Identidade: `name`, `job`, `level`, `userId`.
- Vitalidade: `hp`, `hpMax`.
- Atributos: `forca`, `destreza`, `constituicao`, `sabedoria`, `espirito`,
  `carisma`, `inteligencia`.
- Perícias: `pericias`.
- Economia: `moedas`, além de `currencies` para compatibilidade.
- Inventário e contratos: `itens_inventario`, `contratos_dados`.
- Mundo da ficha: `jogadores`, `npcs`.
- Cofre: `bankSlots`, `bankPassword`.
- Diário e anotações: `notes`, `imagens_anotacoes`, `roomNotes`.
- Montaria: `mountName`, `mountHP`, `mountHPMax`, `mountNotes`.

## Compatibilidade da API

A API continua entregando `FOR`, `DES`, `CON`, `SAB`, `ESP`, `CAR`, `INT`,
`inventory`, `contracts`, `players`, `npcs` e `notesImages` para que a interface
existente não precise ser quebrada. O backend converte esses nomes para os campos
canônicos em português ao criar ou atualizar uma ficha.

`bankPassword` nunca é incluída nas respostas de uma ficha. A validação do cofre
ocorre exclusivamente no backend.

## Campanha do mestre

`PUT /api/campanha` grava no `users.dados_mestre`:

```json
{
  "tituloSessao": "Próxima sessão",
  "anotacoesSessao": "",
  "npcs": [],
  "iniciativa": [],
  "imagensMapas": []
}
```

Somente usuários com perfil `mestre` podem ler ou alterar esse conteúdo.
