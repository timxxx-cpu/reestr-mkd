package uz.reestrmkd.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.auth.api.LoginRequestDto;
import uz.reestrmkd.backend.domain.auth.api.LoginResponseDto;
import uz.reestrmkd.backend.domain.auth.model.UserEntity;
import uz.reestrmkd.backend.domain.auth.model.UserRoleEntity;
import uz.reestrmkd.backend.domain.auth.repository.UserJpaRepository;
import uz.reestrmkd.backend.domain.auth.repository.UserRoleJpaRepository;
import uz.reestrmkd.backend.domain.auth.service.AuthService;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.Base64;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTests {

    @Mock
    private UserJpaRepository userJpaRepository;
    @Mock
    private UserRoleJpaRepository userRoleJpaRepository;

    @Test
    void shouldLoginUsingJpaRepositories() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("tim");
        user.setFullName("Tim User");
        user.setStatus(true);

        UserRoleEntity role = new UserRoleEntity();
        role.setId(100L);
        role.setNameUk("Technician");

        when(userJpaRepository.findFirstByUsernameAndPasswordAndStatusTrue("tim", "secret"))
            .thenReturn(Optional.of(user));
        when(userRoleJpaRepository.findFirstByUserId(7L))
            .thenReturn(Optional.of(role));

        AuthService service = new AuthService(userJpaRepository, userRoleJpaRepository, new ObjectMapper(), "jwt-secret");

        LoginResponseDto response = service.login(new LoginRequestDto("tim", "secret"));

        assertThat(response.ok()).isTrue();
        assertThat(response.user().id()).isEqualTo("tim");
        assertThat(response.user().name()).isEqualTo("Tim User");
        assertThat(response.user().roleId()).isEqualTo(100L);
        assertThat(response.user().role()).isEqualTo("technician");
        assertThat(response.token().split("\\.")).hasSize(3);

        String payloadJson = new String(Base64.getUrlDecoder().decode(response.token().split("\\.")[1]));
        assertThat(payloadJson).contains("\"sub\":\"tim\"");
        assertThat(payloadJson).contains("\"roleId\":100");
        assertThat(payloadJson).contains("\"role\":\"technician\"");
    }

    @Test
    void shouldRejectInvalidCredentials() {
        when(userJpaRepository.findFirstByUsernameAndPasswordAndStatusTrue("tim", "bad"))
            .thenReturn(Optional.empty());

        AuthService service = new AuthService(userJpaRepository, userRoleJpaRepository, new ObjectMapper(), "jwt-secret");

        assertThatThrownBy(() -> service.login(new LoginRequestDto("tim", "bad")))
            .isInstanceOf(ApiException.class)
            .hasMessage("Invalid credentials");
    }

    @Test
    void shouldRejectMissingRole() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("tim");
        user.setStatus(true);

        when(userJpaRepository.findFirstByUsernameAndPasswordAndStatusTrue("tim", "secret"))
            .thenReturn(Optional.of(user));
        when(userRoleJpaRepository.findFirstByUserId(7L))
            .thenReturn(Optional.empty());

        AuthService service = new AuthService(userJpaRepository, userRoleJpaRepository, new ObjectMapper(), "jwt-secret");

        assertThatThrownBy(() -> service.login(new LoginRequestDto("tim", "secret")))
            .isInstanceOf(ApiException.class)
            .hasMessage("User role is not assigned");
    }
}
