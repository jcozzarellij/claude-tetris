---
description: Crea un git worktree aislado en .trees/{nombre} y ejecuta ahi las instrucciones dadas
argument-hint: [instrucciones del requerimiento]
---

Las instrucciones que debes ejecutar de forma aislada, dentro de un worktree nuevo, son:

$ARGUMENTS

Sigue estos pasos en orden:

1. Ejecuta `git status` para confirmar que no hay cambios sin commitear que se puedan perder por accidente.
2. A partir del requerimiento anterior, decide un nombre corto en kebab-case (2-4 palabras, en ingles, minusculas, separadas por guiones, sin espacios ni caracteres especiales) que lo resuma. Este sera `{nombre}`.
3. Verifica que el directorio `.trees` este ignorado por git: `git check-ignore -q .trees`. Si NO esta ignorado, agrega `.trees/` a `.gitignore` y crea un commit para ese cambio antes de continuar.
4. Verifica que `.trees/{nombre}` no exista ya. Si ya existe un worktree con ese nombre, elige un nombre alternativo (agrega un sufijo numerico) en vez de sobrescribirlo.
5. Crea el worktree con una rama nueva:
   `git worktree add .trees/{nombre} -b {nombre}`
6. A partir de este punto, trabaja EXCLUSIVAMENTE dentro de `.trees/{nombre}` (usa esa ruta como base para todas las lecturas/ediciones/comandos). No modifiques archivos fuera de ese worktree ni toques la rama original.
7. Ejecuta ahi, de forma completa, las instrucciones recibidas en `$ARGUMENTS`.
8. Al terminar, reporta: ruta del worktree, nombre de la rama creada, y un resumen breve de lo realizado. No hagas merge del resultado ni borres el worktree salvo que se te pida explicitamente.
