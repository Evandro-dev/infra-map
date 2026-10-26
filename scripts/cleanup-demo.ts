import '@infra/config';
const { prisma } = await import('../packages/database/src/index.ts');

// Elimina exclusivamente o seed conhecido de 22/10; nunca remove mapas personalizados.
const expected = [
  ['TI', 5, 7, 23, 16],
  ['RH', 31, 7, 17, 12],
  ['Açougue', 65, 26, 35, 22],
] as const;
async function main() {
  const maps = await prisma.map.findMany({
    where: { name: 'Mapa territorial — exemplo' },
    include: { elements: true },
  });
  let removed = 0;
  for (const map of maps) {
    const unchanged =
      map.widthMeters === 120 &&
      map.heightMeters === 80 &&
      map.originXMeters === 0 &&
      map.originYMeters === 0 &&
      map.elements.length === 3 &&
      expected.every(([name, x, y, w, h]) =>
        map.elements.some(
          (e) =>
            e.kind === 'AREA' &&
            e.name === name &&
            e.parentId === null &&
            e.deviceId === null &&
            e.xMeters === x &&
            e.yMeters === y &&
            e.widthMeters === w &&
            e.heightMeters === h &&
            e.level === 0 &&
            e.hidden === false &&
            e.locked === false &&
            e.iconKey ===
              ({ TI: 'monitor-cog', RH: 'users', Açougue: 'beef' } as Record<string, string>)[name],
        ),
      );
    if (!unchanged) {
      console.log(`Preservado mapa ${map.id}: difere do exemplo original.`);
      continue;
    }
    await prisma.map.delete({ where: { id: map.id } });
    removed++;
  }
  console.log(`${removed} mapa(s) de exemplo original removido(s). Outros mapas preservados.`);
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
