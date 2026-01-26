import { useState, useCallback, useEffect } from 'react';

/**
 * Хук для валидации данных через Zod
 * @param {import('zod').ZodSchema} schema - Схема валидации
 * @param {Object} data - Данные для проверки
 * @param {boolean} [validateOnChange=true] - Валидировать ли при каждом изменении
 */
export function useValidation(schema, data, validateOnChange = true) {
    // ИСПРАВЛЕНИЕ: Явно указываем тип стейта, чтобы VS Code понимал, 
    // что внутри могут быть любые поля (name, street и т.д.)
    /** @type {[Object.<string, string>, React.Dispatch<React.SetStateAction<Object.<string, string>>>]} */
    const [errors, setErrors] = useState({});
    
    const [isValid, setIsValid] = useState(true);

    const validate = useCallback(() => {
        const result = schema.safeParse(data);
        if (!result.success) {
            const formattedErrors = result.error.format();
            // Преобразуем формат Zod в плоский объект { fieldName: "Error message" }
            /** @type {Object.<string, string>} */
            const simpleErrors = {};
            
            Object.keys(formattedErrors).forEach(key => {
                // @ts-ignore
                if (key !== '_errors' && formattedErrors[key]?._errors?.length > 0) {
                    // @ts-ignore
                    simpleErrors[key] = formattedErrors[key]._errors[0];
                }
            });
            setErrors(simpleErrors);
            setIsValid(false);
            return false;
        } else {
            setErrors({});
            setIsValid(true);
            return true;
        }
    }, [schema, data]);

    // Автоматическая валидация при изменении данных
    useEffect(() => {
        if (validateOnChange) {
            validate();
        }
    }, [data, validateOnChange, validate]);

    return { errors, isValid, validate };
}