package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "units")
public class UnitEntity extends BaseEntity {

    @Column(name = "floor_id", nullable = false)
    private String floorId;

    @Column(name = "extension_id")
    private String extensionId;

    @Column(name = "entrance_id")
    private String entranceId;

    @Column(name = "unit_code")
    private String unitCode;

    @Column(name = "number")
    private String number;

    @Column(name = "unit_type", nullable = false)
    private String unitType;

    @Column(name = "has_mezzanine", nullable = false)
    private Boolean hasMezzanine = false;

    @Column(name = "mezzanine_type")
    private String mezzanineType;

    @Column(name = "total_area")
    private BigDecimal totalArea;

    @Column(name = "living_area")
    private BigDecimal livingArea;

    @Column(name = "useful_area")
    private BigDecimal usefulArea;

    @Column(name = "rooms_count")
    private Integer roomsCount = 0;

    @Column(name = "status")
    private String status = "free";

    @Column(name = "cadastre_number")
    private String cadastreNumber;

    @Column(name = "address_id")
    private String addressId;
}