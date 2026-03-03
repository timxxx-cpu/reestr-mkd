package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "units")
public class UnitEntity extends BaseEntity {

    @Column(name = "floor_id", nullable = false)
    private String floorId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_id", insertable = false, updatable = false)
    private FloorEntity floor;

    @OneToMany(mappedBy = "unit", fetch = FetchType.LAZY)
    private List<RoomEntity> rooms = new ArrayList<>();

    @Column(name = "extension_id")
    private String extensionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "extension_id", insertable = false, updatable = false)
    private BlockExtensionEntity extension;

    @Column(name = "entrance_id")
    private String entranceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "entrance_id", insertable = false, updatable = false)
    private EntranceEntity entrance;

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
