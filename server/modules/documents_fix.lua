lib.callback.register('gcphone:documents:getTypes', function(source)
    return {
        { id = 'id', name = 'DNI / ID', icon = 'ID', color = '#007aff' },
        { id = 'license', name = 'Licencia de Conducir', icon = 'CAR', color = '#34c759' },
        { id = 'passport', name = 'Pasaporte', icon = 'PASS', color = '#ff9500' },
        { id = 'permit', name = 'Permiso Especial', icon = 'DOC', color = '#af52de' },
        { id = 'work_permit', name = 'Permiso de Trabajo', icon = 'WORK', color = '#5856d6' },
        { id = 'insurance', name = 'Seguro', icon = 'SAFE', color = '#ff3b30' },
        { id = 'registration', name = 'Registro Civil', icon = 'REG', color = '#5ac8fa' }
    }
end)
