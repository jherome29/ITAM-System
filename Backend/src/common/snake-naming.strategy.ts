import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm';

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  override columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    const name = customName ?? propertyName;
    if (embeddedPrefixes.length) {
      return toSnakeCase(embeddedPrefixes.join('_') + '_' + name);
    }
    return toSnakeCase(name);
  }

  override joinColumnName(
    relationName: string,
    referencedColumnName: string,
  ): string {
    return toSnakeCase(relationName + '_' + referencedColumnName);
  }

  override joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return toSnakeCase(tableName + '_' + (columnName ?? propertyName));
  }
}
