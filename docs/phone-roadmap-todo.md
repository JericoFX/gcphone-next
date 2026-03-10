# Phone Roadmap TODO

## Framework bridge

- Revisar en QBCore donde conviene delegar la generacion del numero de telefono para evitar un paso extra en `gcphone`.
- En ESX dejar `users.phone_number` como punto de compatibilidad cuando el core/servidor no exponga telefono de otra forma.
- Objetivo futuro: mover esta responsabilidad a funciones por framework/core para que luego ESX u otros puedan enchufarse facil.
- Idea base:
  - `server/bridge/qbcore.lua` expone helpers del core
  - futuro `server/bridge/esx.lua` hace lo mismo
  - `gcphone` consume una interfaz comun y no la implementacion directa del core
- TODO verificado pendiente:
  - usar Context7 / docs oficiales para confirmar si QBCore ya trae un flujo estandar util para numero de telefono o si sigue siendo custom por recurso.

## Dropped phone access

- Estado actual:
  - el telefono tirado ya puede abrirse en `foreign-readonly`
  - el PIN del dueño desbloquea el contexto de solo lectura
  - la UI usa `accessMode = own | foreign-readonly | foreign-full`
- Siguiente paso futuro:
  - habilitar `foreign-full` cambiando guardas centrales, no pantalla por pantalla

## Stolen / reported device

- Agregar flujo para marcar un telefono como robado usando:
  - IMEI
  - numero de telefono
- Dejarlo preparado para futura integracion con CAD/policia.
- Recomendacion:
  - tabla dedicada de reportes
  - estado del dispositivo (`normal`, `stolen`, `recovered`, `flagged`)
  - lookup por `imei` o `phone_number`
  - funciones server exportables para que el CAD pueda consultar o reportar
- Sugerencia de arquitectura:
  - bridge neutro en `server/modules/phone_stolen.lua`
  - callbacks para reporte manual inicial
  - exports para integracion externa futura
