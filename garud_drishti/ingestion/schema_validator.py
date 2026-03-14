class SchemaValidator:
    """
    Validates normalized events against required schema.
    Skips invalid events safely without crashing pipeline.
    """
    
    REQUIRED_FIELDS = {
        'timestamp',
        'event_type', 
        'asset',
        'user'
    }
    
    def validate(self, event: dict) -> bool:
        """
        Check if event has all required fields with non-empty values.
        """
        for field in self.REQUIRED_FIELDS:
            if not event.get(field) or event[field] in ['', None]:
                return False
        return True
