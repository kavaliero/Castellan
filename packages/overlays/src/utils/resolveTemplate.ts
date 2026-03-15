/**
 * Resolves template variables like {viewer}, {amount} in alert config strings.
 * Returns the original string with all {variables} replaced by their values.
 */
export function resolveTemplate(template: string, variables: Record<string, string | number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined ? String(value) : match;
  });
}
