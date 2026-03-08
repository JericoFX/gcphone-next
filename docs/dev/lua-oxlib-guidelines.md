# Guia Lua + ox_lib (gcphone-next)

Esta guia define el estilo de trabajo para callbacks y modulos Lua.

## 1) Callback contract

Para callbacks server-side usar `lib.callback.register`.

Regla:

- validar input primero
- retornar errores claros
- no confiar en data de cliente

Ejemplo de shape recomendado:

```lua
return {
    success = false,
    error = 'INVALID_PAYLOAD'
}
```

Para respuestas exitosas:

```lua
return {
    success = true,
    data = payload
}
```

## 2) Validacion defensiva

Minimo por callback:

1. validar `source` e `identifier`
2. validar tipos y longitudes de campos
3. validar permisos/ownership en server
4. sanitizar strings

Nunca usar estado cliente como fuente de verdad.

## 3) Sanitizadores compartidos

Hoy hay helpers duplicados (`SafeString` y similares) en varios modulos.

Regla para cambios nuevos:

- reusar helper comun cuando exista
- no copiar-pegar sanitizadores en cada archivo

Objetivo:

- menos drift en validacion
- menos bugs por reglas distintas entre modulos

## 4) Errores estandar

Usar codigos cortos y estables, por ejemplo:

- `INVALID_SOURCE`
- `INVALID_PAYLOAD`
- `MISSING_HOST`
- `TOKEN_ERROR`
- `NOT_ALLOWED`

Evitar mensajes ambiguos o distintos para el mismo caso.

## 5) Rate limit y anti-spam

Para acciones spameables (like/follow/search/post):

- agregar cooldown server-side
- usar `GetGameTimer()` + tabla por identifier/action
- responder con error consistente al exceder limite

## 6) SQL y atomicidad

- usar queries atomicas para contadores/follow requests
- preferir `UPDATE ... WHERE ...` con condiciones defensivas
- evitar modificar contadores desde cliente

## 7) Eventos y ownership

En eventos tipo live/call:

- validar participante activo
- validar owner para acciones de moderacion
- rechazar self-target y ids invalidos

## 8) Locale y mensajes

- usar `lib.locale()` y llaves de locale cuando aplique
- evitar strings hardcode nuevos en paths criticos

## 9) Checklist antes de merge

1. callback validado de punta a punta
2. errores estandarizados
3. sin secretos en cliente/NUI
4. smoke test funcional del flujo tocado
5. logs utiles sin filtrar datos sensibles
