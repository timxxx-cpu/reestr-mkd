package uz.reestrmkd.backend.service;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import uz.reestrmkd.backend.domain.registry.api.CreateExtensionRequestDto;
import uz.reestrmkd.backend.domain.registry.api.SyncParkingPlacesRequestDto;
import uz.reestrmkd.backend.domain.registry.api.UpdateExtensionRequestDto;

import static org.assertj.core.api.Assertions.assertThat;

class RegistryRequestValidationTests {

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void shouldRejectInvalidCreateExtensionDto() {
        var dto = new CreateExtensionRequestDto("", "x".repeat(256), null, null, 0, 0, null, null, null);
        var violations = validator.validate(dto);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString())
            .contains("buildingId", "label", "floorsCount", "startFloorIndex");
    }

    @Test
    void shouldRejectInvalidUpdateExtensionDto() {
        var dto = new UpdateExtensionRequestDto("x".repeat(256), 0, 0);
        var violations = validator.validate(dto);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString())
            .contains("label", "floorsCount", "startFloorIndex");
    }

    @Test
    void shouldKeepExistingSyncParkingValidation() {
        var dto = new SyncParkingPlacesRequestDto(-1);
        var violations = validator.validate(dto);

        assertThat(violations).extracting(v -> v.getPropertyPath().toString())
            .contains("targetCount");
    }
}
