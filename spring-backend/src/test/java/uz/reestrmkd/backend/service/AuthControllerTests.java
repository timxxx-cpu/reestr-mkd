package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.auth.api.AuthController;
import uz.reestrmkd.backend.domain.auth.api.LoginRequestDto;
import uz.reestrmkd.backend.domain.auth.api.LoginResponseDto;
import uz.reestrmkd.backend.domain.auth.api.LoginUserDto;
import uz.reestrmkd.backend.domain.auth.service.AuthService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthControllerTests {

    @Mock
    private AuthService authService;

    @Test
    void shouldDelegateLoginToService() {
        AuthController controller = new AuthController(authService);
        LoginRequestDto request = new LoginRequestDto("tim", "secret");
        LoginResponseDto response = new LoginResponseDto(true, "jwt", new LoginUserDto("tim", "Tim", "technician"));

        when(authService.login(request)).thenReturn(response);

        LoginResponseDto actual = controller.login(request).getBody();

        verify(authService).login(request);
        assertThat(actual).isSameAs(response);
    }
}
