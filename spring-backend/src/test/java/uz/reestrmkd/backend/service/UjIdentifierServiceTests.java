package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class UjIdentifierServiceTests {

    private final UjIdentifierService service = new UjIdentifierService();

    @Test
    void shouldGenerateProjectCodeWithSixDigits() {
        assertEquals("UJ000001", service.generateProjectCode(1));
        assertEquals("UJ000000", service.generateProjectCode(null));
    }

    @Test
    void shouldResolveBuildingPrefixUsingFrontendRules() {
        assertEquals("ZR", service.getBuildingPrefix("residential", false));
        assertEquals("ZM", service.getBuildingPrefix("residential", true));
        assertEquals("ZM", service.getBuildingPrefix("residential_multiblock", false));
        assertEquals("ZP", service.getBuildingPrefix("parking_integrated", false));
        assertEquals("ZR", service.getBuildingPrefix("unknown", false));
    }

    @Test
    void shouldGenerateBuildingCodeWithTwoDigits() {
        assertEquals("ZR01", service.generateBuildingCode("ZR", 1));
        assertEquals("ZR00", service.generateBuildingCode("ZR", 0));
    }

    @Test
    void shouldResolveUnitPrefixUsingFrontendMappings() {
        assertEquals("EF", service.getUnitPrefix("flat"));
        assertEquals("EO", service.getUnitPrefix("office_inventory"));
        assertEquals("EP", service.getUnitPrefix("parking_place"));
        assertEquals("EF", service.getUnitPrefix("unknown"));
    }

    @Test
    void shouldGenerateUnitCodeWithStrictFourDigits() {
        assertEquals("EF0001", service.generateUnitCode("EF", 1));
        assertEquals("EO0012", service.generateUnitCode("EO", 12));
        assertEquals("EP0000", service.generateUnitCode("EP", null));
    }

    @Test
    void shouldCalculateNextSequenceNumberByPrefix() {
        assertEquals(3, service.getNextSequenceNumber(List.of("EF0001", "EF0002", "EO0005"), "EF"));
        assertEquals(6, service.getNextSequenceNumber(List.of("EF0001", "EF0002", "EO0005"), "EO"));
    }
}
