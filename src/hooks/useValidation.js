import { useState, useCallback, useEffect } from 'react';

/**
 * Хук для валидации данных через Zod
 * @param {import('zod').ZodSchema} schema - Схема валидации
 * @param {Object} data - Данные для проверки
 * @param {boolean} [validateOnChange=true] - Валидировать ли при каждом изменении
 */
export function useValidation(schema, data, validateOnChange = true) {
  /** @type {[Object.<string, string>, React.Dispatch<React.SetStateAction<Object.<string, string>>>]} */
  const [errors, setErrors] = useState({});
  const [isValid, setIsValid] = useState(true);

  // 1. Сериализуем данные в строку для сравнения содержимого, а не ссылок
  const dataJson = JSON.stringify(data);

  const validate = useCallback(() => {
    const result = schema.safeParse(data);

    if (!result.success) {
      const formattedErrors = result.error.format();
      /** @type {Object.<string, string>} */
      const simpleErrors = {};

      Object.keys(formattedErrors).forEach(key => {
        // @ts-ignore
        if (key !== '_errors' && formattedErrors[key]?._errors?.length > 0) {
          // @ts-ignore
          simpleErrors[key] = formattedErrors[key]._errors[0];
        }
      });

      // 2. State Guard: Обновляем стейт ТОЛЬКО если объект ошибок реально изменился
      // Это предотвращает бесконечный цикл ре-рендеров
      setErrors(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(simpleErrors)) {
          return simpleErrors;
        }
        return prev;
      });

      setIsValid(prev => (prev === false ? prev : false));
      return false;
    } else {
      setErrors(prev => {
        if (Object.keys(prev).length === 0) return prev;
        return {};
      });
      setIsValid(prev => (prev === true ? prev : true));
      return true;
    }
  }, [schema, data]); // Зависим от строки JSON, а не от объекта data

  // Автоматическая валидация при изменении данных
  useEffect(() => {
    if (validateOnChange) {
      validate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataJson, validateOnChange]); // Убрали validate из зависимостей, чтобы разорвать цикл

  return { errors, isValid, validate };
}
